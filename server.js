require('dotenv').config(); 
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

const mongoURI = process.env.MONGO_URI; 
if (!mongoURI) {
    console.error("Error: MONGO_URI missing.");
    process.exit(1); 
}

const studentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, 
    name: String,
    balance: Number
});

const Student = mongoose.model('Student', studentSchema);

// חיבור למסד ומחיקה חזקה
mongoose.connect(mongoURI)
    .then(async () => {
        console.log("✅ מחובר ל-MongoDB");

        // --- מחיקה: מוחק גם לפי קוד וגם לפי שם ---
        try {
            console.log("🔄 מנסה למחוק את יוסי, דני ואריאל...");
            
            const result = await Student.deleteMany({
                $or: [
                    { id: { $in: ["101", "102", "103"] } }, // ניסיון למחוק לפי קוד
                    { name: { $in: ["יוסי כהן", "דני לוי", "אריאל מזרחי"] } } // ניסיון למחוק לפי שם
                ]
            });

            console.log(`🗑️ נמחקו ${result.deletedCount} רשומות.`);
            
            // בדיקה מה נשאר
            const remaining = await Student.find({});
            console.log("📋 תלמידים שנשארו במערכת כרגע:", remaining.map(s => `${s.name} (${s.id})`));

        } catch (e) {
            console.error("❌ שגיאה במחיקה:", e);
        }
    })
    .catch(err => console.error("Error:", err));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- נתיבים ---

app.post('/api/login', async (req, res) => {
    const { code, type } = req.body;
    if (type === 'admin') {
        code === ADMIN_PASSWORD ? res.json({ success: true, role: 'admin' }) : res.json({ success: false, message: 'סיסמה שגויה' });
    } else {
        const student = await Student.findOne({ id: code });
        student ? res.json({ success: true, role: 'student', name: student.name, balance: student.balance }) : res.json({ success: false, message: 'קוד לא נמצא' });
    }
});

app.get('/api/students', async (req, res) => {
    const students = await Student.find({}).select('id name balance');
    res.json(students);
});

app.post('/api/update', async (req, res) => {
    const { studentId, amount } = req.body;
    const updated = await Student.findOneAndUpdate({ id: studentId }, { $inc: { balance: parseInt(amount) } }, { new: true });
    updated ? res.json({ success: true, newBalance: updated.balance }) : res.json({ success: false, message: 'לא נמצא' });
});

app.post('/api/create-student', async (req, res) => {
    const { id, name, balance } = req.body;
    if (await Student.findOne({ id })) return res.json({ success: false, message: "קיים כבר." });
    try {
        await new Student({ id, name, balance: parseInt(balance) || 0 }).save();
        res.json({ success: true, message: "נוצר בהצלחה" });
    } catch (e) { res.json({ success: false, message: "שגיאה" }); }
});

app.post('/api/wipe-students', async (req, res) => {
    await Student.deleteMany({}); 
    res.json({ success: true, message: "הכל נמחק." });
});

app.post('/api/my-balance', async (req, res) => {
    const s = await Student.findOne({ id: req.body.code });
    res.json({ balance: s ? s.balance : 0 });
});

// נתיב המחיקה הידני
app.delete('/api/delete-student/:id', async (req, res) => {
    const result = await Student.deleteOne({ id: req.params.id });
    result.deletedCount > 0 ? res.json({ success: true, message: "נמחק." }) : res.json({ success: false, message: "לא נמצא." });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
