// seedData.js
const bcrypt = require('bcrypt');
const { userService, productService, productImageService } = require('./services');

const generateSKU = () => {
    return 'PRD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

const seedData = async () => {
    try {
        // Create admin user
        const adminUser = await userService.createUser({
            name: 'Admin User',
            email: 'admin@example.com',
            password: await bcrypt.hash('admin123', 10),
            role: 'admin'
        });

        console.log('Admin user created:', adminUser.email);

        // Create a vendor user
        const vendorUser = await userService.createUser({
            name: 'Test Vendor',
            email: 'vendor@example.com',
            password: await bcrypt.hash('vendor123', 10),
            role: 'vendor'
        });

        console.log('Vendor user created:', vendorUser.email);

        const productsData = [
            {
                name: 'Pastel Pen Set',
                description: 'Set of 4 smooth-writing pens in beautiful pastel colors',
                sku: generateSKU(),
                quantity: 100,
                userId: vendorUser._id,
                imageUrl: 'product-img-1.png'
            },
            {
                name: 'Premium Notebooks',
                description: 'High-quality hardcover notebooks with ribbon bookmarks',
                sku: generateSKU(),
                quantity: 50,
                userId: vendorUser._id,
                imageUrl: 'product-img-2.png'
            },
            {
                name: 'Floral Planner',
                description: 'Beautiful spiral-bound planner with floral design and gold accents',
                sku: generateSKU(),
                quantity: 75,
                userId: vendorUser._id,
                imageUrl: 'product-img-3.png'
            },
            {
                name: 'Classic Notebook Set',
                description: 'Set of minimalist notebooks in earth tones',
                sku: generateSKU(),
                quantity: 60,
                userId: vendorUser._id,
                imageUrl: 'product-img-4.png'
            },
            {
                name: 'Art Supply Set',
                description: 'Complete stationery set with notebook and art supplies',
                sku: generateSKU(),
                quantity: 40,
                userId: vendorUser._id,
                imageUrl: 'product-img-5.png'
            }
        ];

        // Create products and images
        for (const productData of productsData) {
            const product = await productService.createProduct({
                name: productData.name,
                description: productData.description,
                sku: productData.sku,
                quantity: productData.quantity,
                userId: productData.userId
            });

            // Add image for the product
            await productImageService.addProductImage({
                productId: product._id,
                imageUrl: productData.imageUrl,
                isPrimary: true
            });

            console.log(`Created product: ${product.name} (SKU: ${product.sku}) with image by vendor: ${vendorUser.name}`);
        }

        console.log('Seed data creation completed successfully');
    } catch (error) {
        console.error('Error seeding data:', error);
        throw error;
    }
};

module.exports = seedData;