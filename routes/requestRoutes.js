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

// Accept uploads for images, audios, and files fields (same as tasks)
router.post(
  '/',
  upload.fields([
    { name: 'images', maxCount: 15 },
    { name: 'audios', maxCount: 15 },
    { name: 'files', maxCount: 15 }
  ]),
  requestController.createRequestWithFiles
);

router.get('/', requestController.getRequests);
router.get('/:id', requestController.getRequestById);

router.put(
  '/:id',
  upload.fields([
    { name: 'images', maxCount: 15 },
    { name: 'audios', maxCount: 15 },
    { name: 'files', maxCount: 15 }
  ]),
  requestController.updateRequestWithFiles
);

router.delete('/:id', requestController.deleteRequest);

module.exports = router;