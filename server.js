require('dotenv').config(); // מאפשר שימוש במשתני סביבה מהקובץ .env
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// --- הגדרות וחיבור למסד הנתונים ---
app.use(bodyParser.json());
app.use(express.static('public'));

// כתובת החיבור נלקחת ממשתנה הסביבה MONGO_URI
const mongoURI = process.env.MONGO_URI; 
if (!mongoURI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in the environment.");
    process.exit(1);
}

mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB Connected Successfully!"))
    .catch(err => console.log("Error connecting to MongoDB:", err));

// --- הגדרת המבנה של תלמיד (Schema) ---
const studentSchema = new mongoose.Schema({
    id: String,      // קוד תלמיד אישי
    name: String,    // שם מלא
    balance: Number  // יתרה נוכחית
});

const Student = mongoose.model('Student', studentSchema);

// סיסמת המורה (נלקחת ממשתנה סביבה)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";

// --- פונקציה לאתחול ראשוני של הכיתה ---
async function initDB() {
    const count = await Student.countDocuments();
    if (count === 0) {
        console.log("Initializing Database with initial students...");
        const initialStudents = [
            { id: "101", name: "יוסי כהן", balance: 50 },
            { id: "102", name: "דני לוי", balance: 120 },
            { id: "103", name: "אריאל מזרחי", balance: 85 }
        ];
        await Student.insertMany(initialStudents);
        console.log("Database initialization complete.");
    }
}
// נריץ את האתחול רק לאחר שהתחברנו ל-DB
mongoose.connection.on('connected', initDB);

// --- נתיבים (Routes) ---

// התחברות
app.post('/api/login', async (req, res) => {
    const { code, type } = req.body;

    if (type === 'admin') {
        if (code === ADMIN_PASSWORD) {
            res.json({ success: true, role: 'admin' });
        } else {
            res.json({ success: false, message: 'סיסמה שגויה' });
        }
    } else {
        const student = await Student.findOne({ id: code });
        if (student) {
            res.json({ success: true, role: 'student', name: student.name, balance: student.balance });
        } else {
            res.json({ success: false, message: 'קוד תלמיד לא נמצא' });
        }
    }
});

// קבלת רשימת תלמידים (למורה)
app.get('/api/students', async (req, res) => {
    const students = await Student.find({}).select('id name balance');
    res.json(students);
});

// עדכון יתרה
app.post('/api/update', async (req, res) => {
    const { studentId, amount } = req.body;
    
    const updatedStudent = await Student.findOneAndUpdate(
        { id: studentId },
        { $inc: { balance: parseInt(amount) } }, // הוספה/הפחתה
        { new: true }
    );

    if (updatedStudent) {
        res.json({ success: true, newBalance: updatedStudent.balance });
    } else {
        res.json({ success: false, message: 'תלמיד לא נמצא' });
    }
});

// קבלת יתרה אישית (לתלמיד)
app.post('/api/my-balance', async (req, res) => {
    const { code } = req.body;
    const student = await Student.findOne({ id: code });
    if(student) {
        res.json({ balance: student.balance });
    } else {
        res.json({ balance: 0 });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});