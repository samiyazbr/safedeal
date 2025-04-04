// Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { google } = require('googleapis');
const bcrypt = require('bcrypt');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = 5001;
const SECRET_KEY = process.env.SECRET_KEY;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Middleware to parse JSON and handle CORS
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://samiyazubair:Samiya%40123@ac-au59xqq-shard-00-00.jygzmc3.mongodb.net:27017,ac-au59xqq-shard-00-01.jygzmc3.mongodb.net:27017,ac-au59xqq-shard-00-02.jygzmc3.mongodb.net:27017/?replicaSet=atlas-xpz5cu-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Mongoose schemas
const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: String,
  fileLinks: [String],
  remark: String,
});

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);
const User = mongoose.model('User', UserSchema);

// Middleware to verify JWT
const tokenVerification = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send('Access Denied');
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).send('Invalid Token');
    req.user = decoded;
    next();
  });
};

// Google OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// OAuth2 authentication route
app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/drive.file',
  });
  res.redirect(authUrl);
});

// OAuth2 callback route
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  res.send('Authentication successful!');
});

// Register new user
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const existingUser = await User.findOne({ username });

  if (existingUser) return res.status(400).send("User already exists");

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword });

  await newUser.save();
  res.send("User registered successfully");
});

// User authentication
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).send('User not found');
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).send('Invalid credentials');
  const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// File upload configuration
const upload = multer({ dest: 'uploads/' });

// Upload Invoice to Google Drive
app.post('/upload', tokenVerification, upload.array('files'), async (req, res) => {
	const { invoiceNumber, remark } = req.body;
	const fileLinks = [];
  
	try {
	  if (!req.files || req.files.length === 0) {
		return res.status(400).send('No files uploaded.');
	  }
  
	  console.log('Files received:', req.files);
  
	  // Upload each file to Google Drive
	  for (const file of req.files) {
		const fileMetadata = { name: file.originalname };
		const media = { body: fs.createReadStream(file.path) };
  
		const driveFile = await drive.files.create({
		  resource: fileMetadata,
		  media: media,
		  fields: 'id, webViewLink',
		});
  
		console.log('Uploaded to Google Drive:', driveFile.data.webViewLink);
		fileLinks.push(driveFile.data.webViewLink);
  
		// Delete the file after upload
		fs.unlinkSync(file.path);
	  }
  
	  // Save invoice to DB
	  const invoice = new Invoice({ invoiceNumber, fileLinks, remark });
	  await invoice.save();
	  res.send('Invoice uploaded successfully');
	} catch (error) {
	  console.error('Error uploading invoice:', error);
	  res.status(500).send('Error uploading file');
	}
  });
// Delete Invoice
app.delete('/delete/:invoiceNumber', tokenVerification, async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const deletedInvoice = await Invoice.findOneAndDelete({ invoiceNumber });

    if (!deletedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting invoice' });
  }
});

// Search Invoice
app.get('/search/:invoiceNumber', tokenVerification, async (req, res) => {
  const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber });
  if (!invoice) return res.status(404).send('Invoice not found');
  res.json(invoice);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});