"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const documentController_js_1 = require("../controllers/documentController.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const router = (0, express_1.Router)();
// All document management routes require admin authentication
router.use(authMiddleware_js_1.requireAdminAuth);
router.post('/', documentController_js_1.upload.single('file'), documentController_js_1.DocumentController.uploadDocument);
router.get('/', documentController_js_1.DocumentController.listDocuments);
router.get('/:id', documentController_js_1.DocumentController.getDocument);
router.delete('/:id', documentController_js_1.DocumentController.deleteDocument);
exports.default = router;
