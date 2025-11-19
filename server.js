require('dotenv').config(); 
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// --- הגדרות וחיבור למסד הנתונים ---
app.use(bodyParser.json());
app.use(express.static('public'));

const mongoURI = process.env.MONGO_URI; 
if (!mongoURI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in the environment.");
    process.exit(1); 
}

// הגדרת המבנה (Schema) לפני החיבור כדי שנוכל להשתמש בו מיד
const studentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, 
    name: String,
    balance: Number
});

const Student = mongoose.model('Student', studentSchema);

// חיבור למסד ומחיקה מיידית של משתמשי הדוגמה
mongoose.connect(mongoURI)
    .then(async () => {
        console.log("MongoDB Connected Successfully!");
        
        // --- ניקוי משתמשי הדוגמה (101, 102, 103) ---
        try {
            const res = await Student.deleteMany({ id: { $in: ["101", "102", "103"] } });
            if (res.deletedCount > 0) {
                console.log(`>>> בוצע ניקוי: נמחקו ${res.deletedCount} משתמשי דוגמה (יוסי, דני, אריאל) <<<`);
            } else {
                console.log(">>> המערכת נקייה ממשתמשי דוגמה <<<");
            }
        } catch (e) {
            console.error("שגיאה בניקוי משתמשים:", e);
        }
    })
    .catch(err => {
        console.error("Error connecting to MongoDB:", err);
        process.exit(1);
    });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- נתיבים (Routes) ---

// 1. התחברות
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

// 2. קבלת רשימת תלמידים (למורה)
app.get('/api/students', async (req, res) => {
    const students = await Student.find({}).select('id name balance');
    res.json(students);
});

// 3. עדכון יתרה
app.post('/api/update', async (req, res) => {
    const { studentId, amount } = req.body;
    
    const updatedStudent = await Student.findOneAndUpdate(
        { id: studentId },
        { $inc: { balance: parseInt(amount) } },
        { new: true }
    );

    if (updatedStudent) {
        res.json({ success: true, newBalance: updatedStudent.balance });
    } else {
        res.json({ success: false, message: 'תלמיד לא נמצא' });
    }
});

// 4. יצירת תלמיד
app.post('/api/create-student', async (req, res) => {
    const { id, name, balance } = req.body;
    
    const existingStudent = await Student.findOne({ id: id });
    if (existingStudent) {
        return res.json({ success: false, message: "קוד תלמיד זה כבר קיים במערכת." });
    }

    const newStudent = new Student({
        id: id,
        name: name,
        balance: parseInt(balance) || 0
    });

    try {
        await newStudent.save();
        res.json({ success: true, message: `התלמיד ${name} נוצר בהצלחה.`, newStudent: newStudent });
    } catch (error) {
        res.json({ success: false, message: "שגיאה בשמירת תלמיד חדש." });
    }
});

// 5. מחיקת כל הנתונים
app.post('/api/wipe-students', async (req, res) => {
    try {
        await Student.deleteMany({}); 
        res.json({ success: true, message: "כל נתוני התלמידים נמחקו בהצלחה. הרשימה ריקה." });
    } catch (error) {
        console.error("Error wiping students:", error);
        res.json({ success: false, message: "שגיאה במחיקת הנתונים." });
    }
});

// 6. קבלת יתרה אישית (לתלמיד)
app.post('/api/my-balance', async (req, res) => {
    const { code } = req.body;
    const student = await Student.findOne({ id: code });
    if(student) {
        res.json({ balance: student.balance });
    } else {
        res.json({ balance: 0 });
    }
});

// 7. מחיקת תלמיד ספציפי
app.delete('/api/delete-student/:id', async (req, res) => {
    const studentId = req.params.id; 
    
    try {
        const result = await Student.deleteOne({ id: studentId });

        if (result.deletedCount === 0) {
            return res.json({ success: false, message: "תלמיד לא נמצא או כבר נמחק." });
        }
        
        res.json({ success: true, message: `תלמיד עם קוד ${studentId} נמחק בהצלחה.` });
    } catch (error) {
        res.json({ success: false, message: "שגיאה במחיקת התלמיד.", error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
