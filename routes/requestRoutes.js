// const express = require('express');
// const router = express.Router();
// const requestController = require('../controllers/requestController');

// router.post('/', requestController.createRequest);
// router.get('/', requestController.getRequests);
// router.get('/:id', requestController.getRequestById);
// router.put('/:id', requestController.updateRequest);
// router.delete('/:id', requestController.deleteRequest);

// module.exports = router;


const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const upload = require('../middleware/multerCloudinary'); // multer-cloudinary middleware

// Accept uploads for image, audio, and file fields
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]),
  requestController.createRequestWithFiles
);

router.get('/', requestController.getRequests);
router.get('/:id', requestController.getRequestById);

router.put(
  '/:id',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]),
  requestController.updateRequestWithFiles
);

router.delete('/:id', requestController.deleteRequest);

module.exports = router;