"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlinkChild = exports.getMyChildren = exports.linkChild = void 0;
const supabase_1 = require("../config/supabase");
const linkChild = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    const { student_code, student_id, full_name } = req.body;
    if (!student_code && !student_id && !full_name) {
        return res.status(400).json({ error: 'Indica código, id o nombre del alumno.' });
    }
    try {
        let query = supabase_1.supabaseAdmin
            .from('students')
            .select('id, full_name, parent_id, category:categories(name)')
            .eq('school_id', school_id);
        if (student_id)
            query = query.eq('id', student_id);
        else if (student_code)
            query = query.eq('student_code', student_code);
        else if (full_name)
            query = query.ilike('full_name', full_name);
        const { data: student, error: findError } = await query.maybeSingle();
        if (findError || !student)
            return res.status(404).json({ error: 'Alumno no encontrado.' });
        if (student.parent_id && student.parent_id !== user_id) {
            return res.status(409).json({ error: 'Alumno ya vinculado a otro padre.' });
        }
        const { data: updated, error: updateError } = await supabase_1.supabaseAdmin
            .from('students')
            .update({ parent_id: user_id })
            .eq('id', student.id)
            .select('id, full_name, avatar_url, category:categories(name)')
            .single();
        if (updateError)
            return res.status(500).json({ error: 'Error al vincular alumno.' });
        res.status(200).json(updated);
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.linkChild = linkChild;
const getMyChildren = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('students')
            .select('id, full_name, avatar_url, status, current_streak, category:categories(id, name, color, monthly_fee)')
            .eq('school_id', school_id)
            .eq('parent_id', user_id)
            .order('full_name');
        if (error)
            return res.status(500).json({ error: 'Error al consultar hijos.' });
        res.status(200).json(data || []);
    }
    catch {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.getMyChildren = getMyChildren;
const unlinkChild = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    const { id } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('students')
            .update({ parent_id: null })
            .eq('id', id)
            .eq('school_id', school_id)
            .eq('parent_id', user_id);
        if (error)
            return res.status(500).json({ error: 'Error al desvincular.' });
        res.status(204).send();
    }
    catch {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.unlinkChild = unlinkChild;
