"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const upload_controller_1 = require("../controllers/upload.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const tenant_middleware_1 = require("../middlewares/tenant.middleware");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth, tenant_middleware_1.requireTenant);
router.post('/avatar', upload.single('image'), (0, tenant_middleware_1.requireRole)('super_admin', 'admin', 'profesor', 'padre', 'alumno'), upload_controller_1.uploadAvatar);
router.post('/logo', upload.single('image'), (0, tenant_middleware_1.requireRole)('super_admin', 'admin'), upload_controller_1.uploadLogo);
exports.default = router;
