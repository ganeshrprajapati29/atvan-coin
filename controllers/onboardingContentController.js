const fs = require('fs');
const OnboardingContent = require('../models/OnboardingContent');
const cloudinary = require('../config/cloudinary');

// Default blocks - mirrors the original hard-coded onboarding slider so
// behaviour is unchanged until an admin edits something from the panel.
const getDefaultBlocks = () => {
  const companyIntro =
    'अत्वन (ATVAN), CIBORI GROUP का एक हिस्सा है। CIBORI GROUP की स्थापना 2010 ' +
    'में हुई थी और यह हॉस्पिटैलिटी, टूरिज्म, हेल्थ एंड न्यूट्रिशन, फाइनेंस, ' +
    'इंपोर्ट-एक्सपोर्ट और इलेक्ट्रिक व्हीकल मैन्युफैक्चरिंग जैसे क्षेत्रों का ' +
    'प्रतिनिधित्व करता है। ATVAN एक इलेक्ट्रिक व्हीकल मैन्युफैक्चरिंग कंपनी है, ' +
    'जो एक बेहतर, सुरक्षित और ईको-फ्रेंडली भविष्य की दिशा में काम कर रही है।';

  const distributionInfo =
    'ATVAN ने अपने 10 करोड़ शेयर में से 70% शेयर बिक्री के लिए उपलब्ध किए हैं। ' +
    'प्रति शेयर कीमत सिर्फ ₹10 है। गारंटीड रिटर्न प्रोग्राम के तहत हर साल शेयर ' +
    'की कीमत बढ़ती रहेगी, और हमारा लक्ष्य इसे जल्द से जल्द ₹1,500 प्रति शेयर तक ' +
    'पहुँचाना है।';

  const roadmap = [
    ['1 Jan 2027', 10], ['1 Jan 2028', 15], ['1 Jan 2029', 25], ['1 Jan 2030', 40],
    ['1 Jan 2031', 55], ['1 Jan 2032', 75], ['1 Jan 2033', 100], ['1 Jan 2034', 200],
    ['1 Jan 2035', 300], ['1 Jan 2036', 500], ['1 Jan 2037', 650], ['1 Jan 2038', 800],
    ['1 Jan 2039', 1000], ['1 Jan 2040', 1150], ['1 Jan 2041', 1300], ['1 Jan 2042', 1500]
  ].map(([year, price]) => ({ year, price }));

  return [
    {
      id: 'hero', page: 0, order: 1, type: 'hero', icon: 'premium',
      title: 'आपका वेल्थ प्लेटफॉर्म',
      subtitle: 'अपने ATVAN Coins सुरक्षित तरीके से ट्रैक, अर्जित और मैनेज करें।',
      styles: { cardStyle: 'gradient' }
    },
    {
      id: 'why-atvan-features', page: 0, order: 2, type: 'features',
      title: 'ATVAN क्यों?',
      benefits: [
        { icon: 'shield', title: 'सुरक्षित ट्रांसफर', description: 'सेफ रिकॉर्ड्स' },
        { icon: 'gift', title: 'रिवॉर्ड बेनिफिट', description: 'बोनस ग्रोथ' },
        { icon: 'premium', title: 'मेंबरशिप', description: 'मेंबर वैल्यू' }
      ]
    },
    {
      id: 'company-info', page: 0, order: 3, type: 'paragraph', icon: 'apartment',
      title: 'ATVAN के बारे में', content: [companyIntro]
    },
    {
      id: 'distribution-info', page: 0, order: 4, type: 'paragraph', icon: 'pie_chart',
      title: 'शेयर डिस्ट्रीब्यूशन', content: [distributionInfo]
    },
    {
      id: 'why-invest', page: 0, order: 5, type: 'bullets',
      title: 'ATVAN में निवेश क्यों करें?',
      content: [
        'CIBORI GROUP अपने दूसरे बिज़नेस के प्रॉफिट का एक हिस्सा भी ATVAN शेयर होल्डर्स को देगा।',
        'हर बिक्री पर ₹5,000 से ₹15,000 तक की वैल्यू सीधे शेयर होल्डर्स को ट्रांसफर की जाएगी।',
        'आने वाला समय इलेक्ट्रिक व्हीकल का है, जिससे बिक्री बढ़ने का सीधा फायदा आप तक पहुँचेगा।',
        'हर व्यक्ति को सिर्फ 10 शेयर ही अलॉट किए जाते हैं, जिससे सभी को बराबर मौका मिलता है।',
        'शेयर की संख्या सीमित रखी गई है, जिससे अनावश्यक खरीद-फरोख्त नहीं होगी।',
        'सीमित सप्लाई और बढ़ती डिमांड की वजह से शेयर की वैल्यू तेज़ी से बढ़ेगी।'
      ]
    },
    {
      id: 'roadmap-chart', page: 0, order: 6, type: 'chart',
      title: 'ATVAN कॉइन वैल्यू रोडमैप', chartRows: roadmap
    },
    {
      id: 'share-benefits', page: 0, order: 7, type: 'bullets',
      title: 'ATVAN शेयर के फायदे',
      content: [
        'फाइनेंशियल सिक्योरिटी का वादा - हर साल गारंटीड मुनाफे की संभावना।',
        'शेयर होल्डर्स के लिए भविष्य में लोन की सुविधा उपलब्ध रहेगी।',
        'बड़े शेयर होल्डर्स को फ्री घर, गाड़ी और पेंशन जैसी सुविधाएं दी जाएंगी।',
        'भविष्य में अपनी दैनिक जरूरतों के लिए भी ATVAN शेयर का उपयोग कर सकते हैं।',
        'रेफर करने पर आपको 10% तक का बोनस मिलेगा।',
        'लकी-ड्रॉ के माध्यम से शेयर धारकों को अतिरिक्त लाभ मिलते रहेंगे।',
        'आप अपना शेयर कभी भी वापस/बेच सकते हैं।'
      ]
    },
    {
      id: 'onboarding-call-cta', page: 0, order: 8, type: 'callCta',
      title: 'अधिक जानकारी के लिए कॉल करें', content: ['9953701057'],
      styles: { cardStyle: 'gold' }
    },
    {
      id: 'roadmap-note', page: 0, order: 9, type: 'note',
      content: ['मूल्य ATVAN द्वारा प्रकाशित शेड्यूल के अनुसार हैं।']
    },
    {
      id: 'app-hero', page: 1, order: 1, type: 'hero', icon: 'smartphone',
      title: 'ऐप में आपके लिए', subtitle: 'ATVAN Coin app में आपको यह सब मिलता है।',
      styles: { cardStyle: 'gradient' }
    },
    {
      id: 'app-benefits', page: 1, order: 2, type: 'bullets', title: 'ऐप के फायदे',
      content: [
        'पब्लिश्ड शेड्यूल के अनुसार आपके कॉइन/शेयर की वैल्यू बढ़ने का मौका मिलता है।',
        'शेयर होल्डर्स के लिए भविष्य में लोन की सुविधा उपलब्ध हो सकती है।',
        'बड़े होल्डर्स को घर, गाड़ी और पेंशन जैसे फायदे मिल सकते हैं।',
        'रेफर करने पर आपको बोनस और नेटवर्क रिवॉर्ड का फायदा मिलेगा।',
        'आपका कॉइन बैलेंस, परचेज़ रिक्वेस्ट और ट्रांज़ैक्शन हिस्ट्री ऐप में साफ़ दिखेगी।',
        'अप्रूवल के बाद सेल/विड्रॉ रिक्वेस्ट को ट्रैक करना आसान रहेगा।'
      ]
    },
    {
      id: 'payment-hero', page: 2, order: 1, type: 'hero', icon: 'verified',
      title: 'सुरक्षित तरीके से कॉइन खरीदें',
      subtitle: 'पेमेंट सबमिट करें, एडमिन अप्रूवल के बाद बैलेंस अपडेट होगा।',
      styles: { cardStyle: 'gradient' }
    },
    {
      id: 'how-it-works', page: 2, order: 2, type: 'steps', title: 'यह कैसे काम करता है',
      benefits: [
        { icon: 'qr_code', title: 'स्कैन करें और पे करें', description: 'QR स्कैनर से पेमेंट करें और UTR/रेफरेंस नंबर सेव करें।' },
        { icon: 'upload', title: 'रिक्वेस्ट सबमिट करें', description: 'अमाउंट और UTR सबमिट करके एडमिन अप्रूवल के लिए भेजें।' },
        { icon: 'wallet', title: 'कॉइन ऐड होंगे', description: 'अप्रूवल के बाद कॉइन और ट्रांज़ैक्शन हिस्ट्री अपडेट होती रहेगी।' }
      ]
    },
    {
      id: 'payment-note', page: 2, order: 3, type: 'note',
      content: ['₹100 के पेमेंट पर 10 कॉइन मिलते हैं। डेली ग्रोथ हिस्ट्री में दिखेगी।']
    },
    {
      id: 'promo-banner', page: 3, order: 1, type: 'promo',
      title: 'आज का छोटा कदम\nकल का बड़ा बदलाव',
      subtitle: 'सिर्फ ₹100 लगाओ और पाओ',
      content: [
        '₹15,000*',
        '₹100',
        '₹15,000',
        'छोटा निवेश  •  बड़ा मुनाफा  •  उज्जवल भविष्य',
        '*10 शेयर पर ₹1,500 प्रति शेयर के प्रोजेक्टेड टारगेट पर आधारित। मूल्य ATVAN द्वारा प्रकाशित शेड्यूल के अनुसार हैं।'
      ],
      benefits: [
        { icon: 'verified', title: 'सुरक्षित और\nभरोसेमंद' },
        { icon: 'trending_up', title: 'ज्यादा रिटर्न\nबेहतर भविष्य' },
        { icon: 'bolt', title: 'तेज़ ग्रोथ\nतेज़ इनकम' },
        { icon: 'wallet', title: 'सीधा पेमेंट\nआपके वॉलेट में' }
      ]
    },
    {
      id: 'promo-call-cta', page: 3, order: 2, type: 'callCta',
      title: 'अधिक जानकारी के लिए कॉल करें', content: ['9953701057'],
      styles: { cardStyle: 'gold' }
    }
  ];
};

// @desc    Get onboarding content
// @route   GET /api/onboarding-content
// @access  Public
const getOnboardingContent = async (req, res) => {
  try {
    let onboardingContent = await OnboardingContent.findOne();
    if (!onboardingContent) {
      onboardingContent = await OnboardingContent.create({
        blocks: getDefaultBlocks(),
        lastUpdated: Date.now()
      });
    }
    onboardingContent.blocks.sort((a, b) => a.page - b.page || a.order - b.order);
    res.json(onboardingContent);
  } catch (error) {
    console.error('Error fetching onboarding content:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Replace all onboarding blocks
// @route   PUT /api/onboarding-content
// @access  Private/Admin
const updateOnboardingContent = async (req, res) => {
  try {
    const { blocks } = req.body;
    const onboardingContent = await OnboardingContent.findOneAndUpdate(
      {},
      { blocks, lastUpdated: Date.now() },
      { upsert: true, new: true, runValidators: true }
    );
    onboardingContent.blocks.sort((a, b) => a.page - b.page || a.order - b.order);
    res.json(onboardingContent);
  } catch (error) {
    console.error('Error updating onboarding content:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a single block
// @route   PUT /api/onboarding-content/block/:id
// @access  Private/Admin
const updateBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const onboardingContent = await OnboardingContent.findOne();
    if (!onboardingContent) {
      return res.status(404).json({ message: 'Onboarding content not found' });
    }

    const index = onboardingContent.blocks.findIndex((block) => block.id === id);
    if (index === -1) {
      return res.status(404).json({ message: 'Block not found' });
    }

    onboardingContent.blocks[index] = {
      ...onboardingContent.blocks[index].toObject(),
      ...updateData
    };

    onboardingContent.lastUpdated = Date.now();
    await onboardingContent.save();

    res.json(onboardingContent.blocks[index]);
  } catch (error) {
    console.error('Error updating onboarding block:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset onboarding content to defaults
// @route   POST /api/onboarding-content/reset
// @access  Private/Admin
const resetOnboardingContent = async (req, res) => {
  try {
    const onboardingContent = await OnboardingContent.findOneAndUpdate(
      {},
      { blocks: getDefaultBlocks(), lastUpdated: Date.now() },
      { upsert: true, new: true }
    );
    res.json(onboardingContent);
  } catch (error) {
    console.error('Error resetting onboarding content:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload an image for an onboarding block (image slider / hero art)
// @route   POST /api/onboarding-content/upload-image
// @access  Private/Admin
const uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }
  const localPath = req.file.path;
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder: 'onboarding',
      resource_type: 'image'
    });
    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    console.error('Error uploading onboarding image:', error);
    res.status(500).json({ message: error.message });
  } finally {
    fs.unlink(localPath, () => {});
  }
};

module.exports = {
  getOnboardingContent,
  updateOnboardingContent,
  updateBlock,
  resetOnboardingContent,
  uploadImage
};
