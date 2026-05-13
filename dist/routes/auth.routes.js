"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const tenant_middleware_1 = require("../middlewares/tenant.middleware");
const router = (0, express_1.Router)();
router.post('/register', auth_controller_1.registerSchool);
router.post('/resolve-student', auth_controller_1.resolveStudentUsername);
router.post('/invite-teacher', auth_middleware_1.requireAuth, tenant_middleware_1.requireTenant, (0, tenant_middleware_1.requireRole)('super_admin', 'admin'), (req, res) => {
    req.body.role = 'profesor';
    (0, auth_controller_1.inviteUser)(req, res);
});
router.post('/invite-parent', auth_middleware_1.requireAuth, tenant_middleware_1.requireTenant, (0, tenant_middleware_1.requireRole)('super_admin', 'admin', 'profesor'), (req, res) => {
    req.body.role = 'padre';
    (0, auth_controller_1.inviteUser)(req, res);
});
router.post('/invite-admin', auth_middleware_1.requireAuth, tenant_middleware_1.requireTenant, (0, tenant_middleware_1.requireRole)('super_admin', 'admin'), auth_controller_1.inviteAdmin);
exports.default = router;
