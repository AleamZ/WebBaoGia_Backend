const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Could not connect to MongoDB', err));


// Mongoose Models

// Define Series Schema
const SeriesSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});

const Series = mongoose.model('Series', SeriesSchema);

// Define Product Schema with Series reference
const ProductSchema = new mongoose.Schema({
  name: String,
  capacity: String,
  color: String,
  code: String,
  battery: String,
  condition: String,
  sellingPrice: Number,
  purchasePrice: Number,
  source: String,
  series: { type: mongoose.Schema.Types.ObjectId, ref: 'Series' }, // Reference to Series
});

const Product = mongoose.model('Product', ProductSchema);

// Define User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', UserSchema);

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send('Token is required');
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(500).send('Invalid Token');
    req.user = decoded;
    next();
  });
};

// Swagger set up
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Product Pricing API',
      version: '1.0.0',
      description: 'API for managing product pricing and user authentication',
      contact: {
        name: 'Your Name',
      },
      servers: [{ url: `http://localhost:${process.env.PORT}` }],
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  apis: ['./server.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication
 */

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product management
 */

/**
 * @swagger
 * tags:
 *   name: Series
 *   description: Series management
 */

// Register a new user (for admin purposes)
/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       500:
 *         description: Server error
 */
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    username,
    password: hashedPassword,
  });

  try {
    await newUser.save();
    res.status(201).send('User registered');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Login user
/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns a JWT token
 *       400:
 *         description: Invalid username or password
 *       500:
 *         description: Server error
 */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).send('User not found');

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).send('Invalid password');

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ token });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Create Series
/**
 * @swagger
 * /api/series:
 *   post:
 *     summary: Create a new series
 *     tags: [Series]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Series created successfully
 *       500:
 *         description: Server error
 */
app.post('/api/series', async (req, res) => {
  const { name } = req.body;

  const newSeries = new Series({ name });

  try {
    await newSeries.save();
    res.status(201).send('Series created successfully');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Fetch all products (public route)
/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Fetch all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of all products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   capacity:
 *                     type: string
 *                   color:
 *                     type: string
 *                   code:
 *                     type: string
 *                   battery:
 *                     type: string
 *                   condition:
 *                     type: string
 *                   sellingPrice:
 *                     type: number
 *                   series:
 *                     type: string
 *                     description: Series of the product
 *       500:
 *         description: Server error
 */
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().populate('series', 'name'); // Populate the series field
    res.json(products);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Fetch full details for logged-in users (protected route)
/**
 * @swagger
 * /api/products/full:
 *   get:
 *     summary: Fetch full product details (requires authentication)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all product details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   capacity:
 *                     type: string
 *                   color:
 *                     type: string
 *                   code:
 *                     type: string
 *                   battery:
 *                     type: string
 *                   condition:
 *                     type: string
 *                   sellingPrice:
 *                     type: number
 *                   purchasePrice:
 *                     type: number
 *                   source:
 *                     type: string
 *                   series:
 *                     type: string
 *                     description: Series of the product
 *       403:
 *         description: Token is required
 *       500:
 *         description: Server error
 */
app.get('/api/products/full', verifyToken, async (req, res) => {
  try {
    const products = await Product.find().populate('series', 'name'); // Populate the series field
    res.json(products);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Create Product
/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               capacity:
 *                 type: string
 *               color:
 *                 type: string
 *               code:
 *                 type: string
 *               battery:
 *                 type: string
 *               condition:
 *                 type: string
 *               sellingPrice:
 *                 type: number
 *               purchasePrice:
 *                 type: number
 *               source:
 *                 type: string
 *               seriesId:
 *                 type: string
 *                 description: The ID of the series to associate the product with
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
app.post('/api/products', async (req, res) => {
  const { name, capacity, color, code, battery, condition, sellingPrice, purchasePrice, source, seriesId } = req.body;

  try {
    // Find the series by ID
    const series = await Series.findById(seriesId);
    if (!series) {
      return res.status(400).send('Series not found');
    }

    // Create the new product
    const newProduct = new Product({
      name,
      capacity,
      color,
      code,
      battery,
      condition,
      sellingPrice,
      purchasePrice,
      source,
      series: series._id, // Link the product to the series
    });

    // Save the product
    await newProduct.save();
    res.status(201).send('Product created successfully');
  } catch (err) {
    res.status(500).send(`Error creating product: ${err.message}`);
  }
});
  // Fetch all series (public route)
/**
 * @swagger
 * /api/series:
 *   get:
 *     summary: Fetch all series
 *     tags: [Series]
 *     responses:
 *       200:
 *         description: List of all series
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: Series ID
 *                   name:
 *                     type: string
 *                     description: Series name
 *       500:
 *         description: Server error
 */
app.get('/api/series', async (req, res) => {
  try {
    const series = await Series.find(); // Fetch all series
    res.json(series);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
// Fetch all series (public route)
app.get('/api/series', async (req, res) => {
  try {
    const series = await Series.find(); // Fetch all series
    res.json(series);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Fetch series by ID and return name
/**
 * @swagger
 * /api/series/{id}:
 *   get:
 *     summary: Fetch series name by ID
 *     tags: [Series]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The series ID
 *     responses:
 *       200:
 *         description: Series name
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: Series ID
 *                 name:
 *                   type: string
 *                   description: Series name
 *       404:
 *         description: Series not found
 *       500:
 *         description: Server error
 */
app.get('/api/series/:id', async (req, res) => {
  try {
    const series = await Series.findById(req.params.id);
    if (!series) {
      return res.status(404).send('Series not found');
    }
    res.json({ _id: series._id, name: series.name });
  } catch (err) {
    res.status(500).send(err.message);
  }
});
// Fetch product by ID
/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Fetch product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: Product ID
 *                 name:
 *                   type: string
 *                   description: Product name
 *                 capacity:
 *                   type: string
 *                 color:
 *                   type: string
 *                 code:
 *                   type: string
 *                 battery:
 *                   type: string
 *                 condition:
 *                   type: string
 *                 sellingPrice:
 *                   type: number
 *                 purchasePrice:
 *                   type: number
 *                 source:
 *                   type: string
 *                 series:
 *                   type: string
 *                   description: Series of the product
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('series', 'name');
    if (!product) {
      return res.status(404).send('Product not found');
    }
    res.json(product);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
// Fetch products by Series ID
/**
 * @swagger
 * /api/products/series/{seriesId}:
 *   get:
 *     summary: Fetch products by Series ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: seriesId
 *         required: true
 *         schema:
 *           type: string
 *         description: The series ID to fetch products from
 *     responses:
 *       200:
 *         description: List of products in the series
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: Product ID
 *                   name:
 *                     type: string
 *                     description: Product name
 *                   capacity:
 *                     type: string
 *                   color:
 *                     type: string
 *                   code:
 *                     type: string
 *                   battery:
 *                     type: string
 *                   condition:
 *                     type: string
 *                   sellingPrice:
 *                     type: number
 *                   purchasePrice:
 *                     type: number
 *                   source:
 *                     type: string
 *                   series:
 *                     type: string
 *                     description: Series of the product
 *       404:
 *         description: Series not found or no products in this series
 *       500:
 *         description: Server error
 */
app.get('/api/products/series/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const series = await Series.findById(seriesId);
    if (!series) {
      return res.status(404).send('Series not found');
    }

    const products = await Product.find({ series: seriesId }).populate('series', 'name');
    res.json(products);
  } catch (err) {
    res.status(500).send(err.message);
  }
});








// Start server
app.listen(process.env.PORT, () => {
  const swaggerUrl = `http://localhost:${process.env.PORT}/api-docs`;
  console.log(`Server running on port ${process.env.PORT}`);
  console.log(`Swagger UI available at ${swaggerUrl}`);
});
