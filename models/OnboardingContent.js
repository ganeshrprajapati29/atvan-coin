const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String, default: '' },
  publicId: { type: String, default: '' },
  alt: { type: String, default: '' }
}, { _id: false });

const chartRowSchema = new mongoose.Schema({
  year: { type: String, default: '' },
  price: { type: Number, default: 0 }
}, { _id: false });

const benefitSchema = new mongoose.Schema({
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' }
}, { _id: false });

const stylesSchema = new mongoose.Schema({
  cardStyle: {
    type: String,
    enum: ['plain', 'card', 'gradient', 'gold', 'dark'],
    default: 'card'
  },
  textAlign: {
    type: String,
    enum: ['left', 'center', 'right'],
    default: 'left'
  },
  fontSize: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium'
  },
  fontWeight: {
    type: String,
    enum: ['normal', 'bold', 'extrabold'],
    default: 'normal'
  },
  textColor: { type: String, default: '' },
  backgroundColor: { type: String, default: '' }
}, { _id: false });

// A single content block on the onboarding slider. `page` groups blocks
// into swipeable slides (0-based); `order` sorts blocks within a page.
const blockSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  page: {
    type: Number,
    required: true,
    default: 0
  },
  type: {
    type: String,
    required: true,
    enum: [
      'hero',
      'paragraph',
      'bullets',
      'chart',
      'features',
      'promo',
      'callCta',
      'note',
      'imageSlider'
    ]
  },
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  content: [{ type: String }],
  benefits: [benefitSchema],
  chartRows: [chartRowSchema],
  images: [imageSchema],
  styles: { type: stylesSchema, default: () => ({}) },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const onboardingContentSchema = new mongoose.Schema({
  blocks: [blockSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OnboardingContent', onboardingContentSchema);
