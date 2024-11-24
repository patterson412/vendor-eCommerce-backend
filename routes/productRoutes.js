const express = require('express');
const router = express.Router();
const { userService, productService, productImageService, favouriteService } = require('../services');
const auth = require('../middlewares/auth');
const { upload, saveImageWithWatermark } = require('../middlewares/uploadMiddleware');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { ObjectId } = require('mongodb');

const generateSKU = () => {
    return 'PRD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

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
                    return { ...product, images };
                } catch (imageError) {
                    console.error(`Error fetching images for product ${product._id}:`, imageError);
                    return { ...product, images: [] };
                }
            })
        );

        console.log(`Fetched ${productsWithImages.length} products\n--------------------------------`);
        console.log(JSON.stringify(productsWithImages, null, 2));

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });

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
    const { name, description, quantity, price, primaryImageIndex = 0 } = req.body;
    const images = req.files;
    const user = req.user;

    if (!name || !description || !quantity || !price) {
        return res.status(400).json({ msg: 'All fields are required' });
    }

    try {
        const newProduct = await productService.createProduct({ name, sku: generateSKU(), description, quantity, price, userId: user._id });
        if (images && images.length > 0) {
            await Promise.all(images.map(async (image, index) => {
                const imageName = await saveImageWithWatermark(image);
                await productImageService.addProductImage({ productId: newProduct._id, imageUrl: imageName, isPrimary: primaryImageIndex ? parseInt(primaryImageIndex) === index : (index === 0 ? true : false) });
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
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        return res.status(200).json({
            product: productWithImages
        });
    } catch (error) {
        console.error('Error creating product:', error);
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

        console.log(`Fetched total favourites ${productsWithImages.length} products\n--------------------------------`);
        console.log(JSON.stringify(productsWithImages, null, 2));

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });

        return res.status(200).json({ favourites: productsWithImages });

    } catch (error) {
        console.error('Error fetching favourites:', error);
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
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
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
        console.log('Product removed from favourites with ID: ', id);

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
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

            console.log(`Fetched product ${id}\n--------------------------------`);
            console.log(JSON.stringify(productWithImages, null, 2));

            const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
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

router.put('/:id', auth, upload, async (req, res) => {
    const { id } = req.params;
    const { name, description, quantity, price, primaryImageIndex = 0, imageIdsToDelete = [] } = req.body;
    const images = req.files;
    const user = req.user;

    if (!name || !description || !quantity || !price) {
        return res.status(400).json({ msg: 'All fields are required' });
    }

    try {
        const product = await productService.getProductById(new ObjectId(id));
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        const updatedProduct = await productService.updateProduct(new ObjectId(id), { name, description, quantity, price });

        if (images && images.length > 0) {
            await productImageService.deleteProductImages(updatedProduct._id);
            await Promise.all(images.map(async (image, index) => {
                const imageName = await saveImageWithWatermark(image);
                await productImageService.addProductImage({ productId: updatedProduct._id, imageUrl: imageName, isPrimary: primaryImageIndex ? parseInt(primaryImageIndex) === index : (index === 0 ? true : false) });
            }));
        } else {
            if (imageIdsToDelete.length > 0) {
                await Promise.all(imageIdsToDelete.map(async (imageId) => {
                    await productImageService.deleteImage(new ObjectId(imageId));
                }));
            }

            const remainingImages = await productImageService.getProductImages(updatedProduct._id);
            if (remainingImages.length > 0) {
                remainingImages.forEach(async (image, index) => {
                    if (index === parseInt(primaryImageIndex)) {
                        await productImageService.setPrimaryImage(updatedProduct._id, image._id);
                    }
                });
            }
        }

        const productImages = await productImageService.getProductImages(updatedProduct._id);
        const productWithImages = {
            ...(updatedProduct.toJSON()),
            images: productImages.map(image => ({
                _id: image._id.toString(),
                productId: image.productId,
                imageUrl: `/uploads/${image.imageUrl}`,
                isPrimary: image.isPrimary
            }))
        };

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        return res.status(200).json({
            product: productWithImages
        });
    } catch (error) {
        console.error('Error updating product:', error);
        return res.status(500).json({ msg: error.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const productToDelete = await productService.getProductById(new ObjectId(id));
        if (!productToDelete) {
            console.log('Product not found');
            return res.status(404).json({ msg: 'Product not found' });
        }
        await productService.deleteProduct(new ObjectId(id));
        console.log('Deleted product');
        const existsInFavourites = await favouriteService.existsInFavourites(new ObjectId(id));
        if (existsInFavourites) {
            await favouriteService.deleteAllFromFavourites(new ObjectId(id));
            console.log('Deleted product from favourites');
        }
        const imagesToDelete = await productImageService.getProductImages(new ObjectId(id));
        if (imagesToDelete.length > 0) {
            await productImageService.deleteProductImages(new ObjectId(id));
            console.log('Deleted product images');
        }

        const token = jwt.sign({ id: user._id.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        return res.status(200).json({ msg: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ msg: error.message });
    }
});

module.exports = router;