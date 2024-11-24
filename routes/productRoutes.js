const express = require('express');
const router = express.Router();
const { userService, productService, productImageService, favouriteService } = require('../services');
const auth = require('../middlewares/auth');
const { upload, saveImageWithWatermark } = require('../middlewares/uploadMiddleware');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { ObjectId } = require('mongodb');

router.get('/', auth, async (req, res) => {
    const user = req.user;
    try {
        const { limit = 10, page = 1, sort = {}, ...filters } = req.query;
        const parsedLimit = parseInt(limit);
        const parsedPage = parseInt(page);
        const skip = (parsedPage - 1) * parsedLimit;

        const { products, total } = await productService.getAllProducts(filters, sort, parsedLimit, skip);
        if (!products || products.length === 0) {
            return res.status(404).json({ msg: 'No products found' });
        }

        const transformedProducts = products.map(product => product.toJSON());

        const productsWithImages = await Promise.all(
            transformedProducts.map(async product => {
                try {
                    let images = await productImageService.getProductImages(new ObjectId(product._id)) || [];
                    if (images.length > 0) {
                        images = images.map(image => ({
                            _id: image._id.toString(),
                            productId: image.productId,
                            imageUrl: `/uploads/${image.imageUrl}`,
                            isPrimary: image.isPrimary
                        }));
                    }
                    const isFavourited = await favouriteService.isProductFavourited(user._id, new ObjectId(product._id));
                    return { ...product, images, favourite: isFavourited };
                } catch (imageError) {
                    console.error(`Error fetching images for product ${product._id}:`, imageError);
                    return { ...product, images: [] };
                }
            })
        );

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'Strict', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });

        return res.status(200).json({
            products: productsWithImages,
            pagination: {
                total,
                page: parsedPage,
                pages: Math.ceil(total / parsedLimit)
            }
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ msg: error.message });
    }
});

router.post('/', auth, upload, async (req, res) => {
    const { name, description, quantity, sku, price, primaryImageIndex } = req.body;
    const images = req.files;
    const user = req.user;

    if (!name || !description || !quantity || !price || !sku) {
        return res.status(400).json({ msg: 'All fields are required' });
    }

    try {
        const newProduct = await productService.createProduct({ name, sku, description, quantity, price, userId: user._id });

        if (images && images.length > 0) {
            await Promise.all(images.map(async (image, index) => {
                const imageName = await saveImageWithWatermark(image);
                const isPrimary = primaryImageIndex ?
                    parseInt(primaryImageIndex) === index :
                    index === 0;

                await productImageService.addProductImage({
                    productId: newProduct._id,
                    imageUrl: imageName,
                    isPrimary
                });
            }));
        }

        const productImages = await productImageService.getProductImages(newProduct._id);
        const productWithImages = {
            ...(newProduct.toJSON()),
            images: productImages.map(image => ({
                _id: image._id.toString(),
                productId: image.productId,
                imageUrl: `/uploads/${image.imageUrl}`,
                isPrimary: image.isPrimary
            }))
        };

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'Strict', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        return res.status(200).json({
            product: productWithImages
        });
    } catch (error) {
        console.error('Error creating product:', error);
        return res.status(500).json({ msg: error.message });
    }
});

router.put('/:id', auth, upload, async (req, res) => {
    const { id } = req.params;
    const { name, description, quantity, price, sku, primaryImageIndex, imagesToDelete = [] } = req.body;
    const images = req.files;
    const user = req.user;

    if (!name || !description || !quantity || !price || !sku) {
        return res.status(400).json({ msg: 'All fields are required' });
    }

    try {
        const product = await productService.getProductById(new ObjectId(id));
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const updatedProduct = await productService.updateProduct(new ObjectId(id), {
            name, description, quantity, price, sku
        });

        // Handle image updates
        let existingImages = await productImageService.getProductImages(updatedProduct._id);

        // Delete specific images if requested
        if (imagesToDelete && imagesToDelete.length > 0) {
            const parsedImageIds = Array.isArray(imagesToDelete) ?
                imagesToDelete :
                JSON.parse(imagesToDelete);

            console.log('Parsed image IDs:', parsedImageIds);

            await Promise.all(parsedImageIds.map(async (imageId) => {
                await productImageService.deleteImage(new ObjectId(imageId));
            }));

            // Update existing images list after deletion
            existingImages = existingImages.filter(
                img => !parsedImageIds.includes(img._id.toString())
            );
        }

        // Handle new image uploads
        if (images && images.length > 0) {
            const newImagePromises = images.map(async (image, index) => {
                const imageName = await saveImageWithWatermark(image);
                return productImageService.addProductImage({
                    productId: updatedProduct._id,
                    imageUrl: imageName,
                    isPrimary: false // Initially set all new images as non-primary
                });
            });

            const newImages = await Promise.all(newImagePromises);
            existingImages = [...existingImages, ...newImages];
        }

        // Handle primary image selection
        if (primaryImageIndex !== undefined) {
            // First, reset all images to non-primary
            await Promise.all(existingImages.map(async (image) => {
                await productImageService.updateImage(image._id, { isPrimary: false });
            }));

            // Calculate the correct image to set as primary
            const allImages = existingImages;
            const primaryImagePosition = parseInt(primaryImageIndex);

            if (primaryImagePosition >= 0 && primaryImagePosition < allImages.length) {
                const primaryImage = allImages[primaryImagePosition];
                await productImageService.updateImage(primaryImage._id, { isPrimary: true });
            } else {
                // If invalid primary index, set the first image as primary
                if (allImages.length > 0) {
                    await productImageService.updateImage(allImages[0]._id, { isPrimary: true });
                }
            }
        } else if (existingImages.length > 0 && !existingImages.some(img => img.isPrimary)) {
            // Ensure there's always a primary image if images exist
            await productImageService.updateImage(existingImages[0]._id, { isPrimary: true });
        }

        // Get final updated product with images
        const finalProductImages = await productImageService.getProductImages(updatedProduct._id);
        const productWithImages = {
            ...(updatedProduct.toJSON()),
            images: finalProductImages.map(image => ({
                _id: image._id.toString(),
                productId: image.productId,
                imageUrl: `/uploads/${image.imageUrl}`,
                isPrimary: image.isPrimary
            }))
        };

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'Strict', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        return res.status(200).json({
            product: productWithImages
        });
    } catch (error) {
        console.error('Error updating product:', error);
        return res.status(500).json({ msg: error.message });
    }
});

router.get('/favourites', auth, async (req, res) => {
    const user = req.user;
    try {
        const favourites = await favouriteService.getUserFavourites(user._id);
        if (!favourites || favourites.length === 0) {
            return res.status(200).json({ favourites: [] });
        }

        const transformedProducts = favourites.map(favourite => favourite.toJSON()).map(favProduct => favProduct.productId);

        const productsWithImages = await Promise.all(
            transformedProducts.map(async product => {
                try {
                    let images = await productImageService.getProductImages(new ObjectId(product._id)) || [];
                    if (images.length > 0) {
                        images = images.map(image => ({
                            _id: image._id.toString(),
                            productId: image.productId,
                            imageUrl: `/uploads/${image.imageUrl}`,
                            isPrimary: image.isPrimary
                        }));
                    }
                    return { ...product, images };
                } catch (imageError) {
                    console.error(`Error fetching images for product ${product._id}:`, imageError);
                    return { ...product, images: [] };
                }
            })
        );

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'Strict', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });

        return res.status(200).json({ favourites: productsWithImages });
    } catch (error) {
        console.error('Error fetching favourites:', error);
        return res.status(500).json({ msg: error.message });
    }
});

router.post('/favourites/toggle/:id', auth, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        await favouriteService.toggleFavourite(user._id, new ObjectId(id));
        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'Strict', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        return res.status(200).json({ msg: 'Favourite toggled successfully' });
    } catch (error) {
        console.error('Error toggling favourite:', error);
        return res.status(500).json({ msg: error.message });
    }
});

router.post('/favourites/:id', auth, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const product = await productService.getProductById(new ObjectId(id));
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }
        await favouriteService.addToFavourites(user._id, new ObjectId(id));

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'Strict', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        return res.status(200).json({ msg: 'Product added to favourites successfully' });
    } catch (error) {
        console.error('Error adding to favourites:', error);
        return res.status(500).json({ msg: error.message });
    }
});

router.delete('/favourites/:id', auth, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const isProductFavourited = await favouriteService.isProductFavourited(user._id, new ObjectId(id));
        if (!isProductFavourited) {
            return res.status(404).json({ msg: 'Product already not favourited' });
        }
        await favouriteService.removeFromFavourites(user._id, new ObjectId(id));

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'Strict', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        return res.status(200).json({ msg: 'Product removed from favourites' });
    } catch (error) {
        console.error('Error removing from favourites:', error);
        return res.status(500).json({ msg: error.message });
    }
});

router.get('/:id', auth, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const product = await productService.getProductById(id);
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const transformedProduct = product.toJSON();

        try {
            let images = await productImageService.getProductImages(new ObjectId(transformedProduct._id)) || [];
            if (images.length > 0) {
                images = images.map(image => ({
                    _id: image._id.toString(),
                    productId: image.productId,
                    imageUrl: `/uploads/${image.imageUrl}`,
                    isPrimary: image.isPrimary
                }));
            }

            const productWithImages = { ...transformedProduct, images };

            const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'Strict', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
            return res.status(200).json({ product: productWithImages });
        } catch (imageError) {
            console.error(`Error fetching images for product ${id}:`, imageError);
            return res.status(200).json({ product: { ...transformedProduct, images: [] } });
        }
    } catch (error) {
        console.error('Error fetching product:', error);
        return res.status(500).json({ msg: error.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const productToDelete = await productService.getProductById(new ObjectId(id));
        if (!productToDelete) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        // Delete the product and related data
        await Promise.all([
            productService.deleteProduct(new ObjectId(id)),
            favouriteService.deleteAllFromFavourites(new ObjectId(id)),
            productImageService.deleteProductImages(new ObjectId(id))
        ]);

        // Here to note is the actual image file stored in the uploads folder is not deleted. For demo purposes the image file is kept. If needed can be deleted using the fs module. :)

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'Strict', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        return res.status(200).json({ msg: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ msg: error.message });
    }
});

module.exports = router;