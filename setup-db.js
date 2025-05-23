const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Define a simplified User schema (without all the methods)
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  xp: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  rating: {
    type: Number,
    default: 0
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  metrics: {
    topics: [String],
    sentimentScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    complexity: {
      type: String,
      enum: ['beginner', 'intermediate', 'expert'],
      default: 'beginner'
    },
    userType: String,
    totalMessages: {
      type: Number,
      default: 0
    },
    avgChatLength: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  suggestions: [String],
  subscription: {
    type: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

// Create admin user if not exists
async function setupDatabase() {
  try {
    // Check if admin exists
    const adminExists = await User.findOne({ email: 'admin@vucamax.com' });
    
    if (!adminExists) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      // Create admin
      const admin = new User({
        username: 'admin',
        email: 'admin@vucamax.com',
        password: hashedPassword,
        role: 'admin',
        level: 10,
        xp: 1500,
        metrics: {
          topics: ['AI', 'Leadership', 'Technology'],
          sentimentScore: 0.9,
          complexity: 'expert',
          userType: 'administrator',
          totalMessages: 150,
          avgChatLength: 12,
          lastUpdated: new Date()
        },
        suggestions: [
          'Focus on effective delegation to team members',
          'Continue developing strategic communication skills',
          'Share insights across organization to build knowledge base'
        ]
      });
      
      await admin.save();
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }
    
    // Create a test user if not exists
    const testUserExists = await User.findOne({ email: 'test@vucamax.com' });
    
    if (!testUserExists) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('test123', salt);
      
      // Create test user
      const testUser = new User({
        username: 'testuser',
        email: 'test@vucamax.com',
        password: hashedPassword,
        level: 3,
        xp: 350,
        metrics: {
          topics: ['Career Growth', 'Communication', 'Personal Development'],
          sentimentScore: 0.7,
          complexity: 'intermediate',
          userType: 'analytical learner',
          totalMessages: 45,
          avgChatLength: 8,
          lastUpdated: new Date()
        },
        suggestions: [
          'Try asking more open-ended questions to deepen conversations',
          'Consider exploring topics outside your comfort zone',
          'Practice more reflective communication patterns'
        ]
      });
      
      await testUser.save();
      console.log('Test user created');
    } else {
      console.log('Test user already exists');
    }
    
    console.log('Database setup complete');
    
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

setupDatabase(); 