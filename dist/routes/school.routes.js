"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const school_controller_1 = require("../controllers/school.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const tenant_middleware_1 = require("../middlewares/tenant.middleware");
const router = (0, express_1.Router)();
router.put('/:id', auth_middleware_1.requireAuth, tenant_middleware_1.requireTenant, (0, tenant_middleware_1.requireRole)('super_admin', 'admin'), school_controller_1.updateSchool);
exports.default = router;
