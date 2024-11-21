const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = 4000;
const JWT_SECRET = 'Teamjj'; // Define your secret key

mongoose
  .connect('mongodb+srv://Teamjj:Teamjj@streamvibes.opjda.mongodb.net/?retryWrites=true&w=majority&appName=StreamVibes', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'Users'
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['viewer', 'streamer'] }
});

const User = mongoose.model('User', userSchema);

app.post('/api/signup', async (req, res) => {
  const { username, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    username,
    email,
    password: hashedPassword,
    role
  });

  try {
    await user.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Error creating user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, role: user.role });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

