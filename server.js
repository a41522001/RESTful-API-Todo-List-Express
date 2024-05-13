//mongodb配置
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://a41522001:a41522001@cluster0.o8y0mnv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
let db = null;
async function run() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("成功連結資料庫");
        db = client.db("TodoList");
    } catch(e){
        console.log("有錯誤",e);
    }
}
run().catch(console.dir);

//套件配置
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const PORT = 3000;
const SECRET_KEY = "key";
app.set("view engine", "ejs");
app.set("views", "./views");
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
let datas;

//JWT驗證
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

//有關CRUD的路由最後都要重新讀取資料庫的檔案
async function loadTodo(email){
    try{
        const collection = db.collection("member");
        datas = await collection.findOne({
            email: email
        })  
    }catch(err){
        console.log(err);
    }
} 
//路由配置
app.get("/", authenticateToken, async (req, res) => {
    try{
        await loadTodo(req.user.email);
        res.status(200).json({
            status: "success",
            data: datas
        });
    }catch{
        res.status(500).json({
            status: "error",
            message: "取得數據失敗請重新再試"
        });
    }  
});
app.post("/", async (req, res) => {
    try{
        const { title, email } = req.body;
        const collection = db.collection("member");
        let result = await collection.findOne({
            email
        })
        let todos = result.todos;
        let todo = {
            id: uuidv4(),
            title,
            done: false
        }
        todos.push(todo);
        await collection.updateOne(
            {
                email: email
            },{
                $set: {
                    todos: todos
                }
            }
        );
        await loadTodo(email);
        res.status(200).json({
            status: "success",
        });    
    }catch{
        res.status(500).json({
            status: "fail",
            message: "資料庫連結錯誤"
        });
    }
})
app.delete("/:id", async (req, res) => {
    const id = req.params.id;
    const email = req.query.email;
    if(id == "" || id == undefined || id == null){
        return;
    }
    try{
        const collection = db.collection("member");
        let result = await collection.findOne({
            email: email
        })
        let todos = result.todos;
        let index = todos.findIndex(todo => todo.id === id );
        todos.splice(index, 1);
        await collection.updateOne(
            {
                email: email
            },{
                $set: {
                    todos: todos
                }
            }
        );
        await loadTodo(email);
        res.status(200).json({
            status: "success",
        });
    }catch{
        res.status(404).json({
            status: "fail",
            message: "找不到要刪除的資料"
        });
    }
});
app.patch("/title/:id", async(req, res) => {
    const id = req.params.id;
    const { title, email } = req.body;
    if(!id || !title){
        res.status(400).json({
            status: "fail",
            message: "請填入需更改的資料"
        })
        return;
    }
    try{
        const collection = db.collection("member");
        let result = await collection.findOne(
            {
                email: email
            }
        );
        let todos = result.todos;
        let index = todos.findIndex(todo => todo.id === id);
        todos[index].title = title;
        await collection.updateOne(
            {
                email: email
            },{
                $set: {
                    todos: todos
                }
            }
        );
        await loadTodo();
        res.status(200).json({
            status: "success",
        })
    }catch{
        res.status(404).json({
            status: "fail",
            message: "找不到該資料"
        })
    }
})
app.patch("/done/:id", async (req, res) => {
    const id = req.params.id;
    const email = req.query.email
    try{
        const collection = db.collection("member");
        let result = await collection.findOne({
            email: email
        })
        let todos = result.todos;
        let index = todos.findIndex(todo => todo.id === id);
        if(todos[index].done){
            todos[index].done = false;
        }else{
            todos[index].done = true;
        }
        await collection.updateOne(
            {
                email: email
            },{
                $set: {
                    todos: todos
                }
            }
        );
        await loadTodo(email);
        res.status(200).json({
            status: "success",
        });
    }catch{
        res.status(404).json({
            status: "fail",
            message: "找不到要更新的資料"
        });
    }
});
app.post("/signup", async (req, res) => {
    const datas = req.body;
    const { userName, email, password, number, date, birthday, todos } = datas;
    try{
        const collection = db.collection("member");
        let result = await collection.findOne({
            email: email
        })
        if(result === null){
            await collection.insertOne({
                userName,
                email,
                password,
                number,
                date,
                birthday,
                todos
            })
            res.status(200).json({
                status: "success"
            })
        }else{
            res.status(400).json({
                status: "fail",
                message: "信箱已存在"
            })
        }
    }catch(err){
        console.log(err);
        res.status(500).json({
            status: "fail",
            message: "伺服器錯誤"
        })
    }   
});
app.post("/login", async (req, res) => {
    const datas = req.body;
    const { email, password } = datas;
    try{
        const collection = db.collection("member");
        let user = await collection.findOne({
            $and: [
                {email: email},
                {password: password}
            ]
        })
        if(user){
            //創建JWT
            const token = jwt.sign(
                { id: user._id, email: user.email},
                SECRET_KEY,
                { expiresIn: "1h" }
            );
            res.status(200).json({
                status: "success",
                token: token
            })
        }else{
            res.status(404).json({
                status: "fail",
                message: "找不到此帳號或密碼"
            })
        }
    }catch(err){
        console.log(err);
        res.status(500).json({
            status: "fail",
            message: "伺服器錯誤"
        })
    }
});
app.post("/forgetPassword", async (req, res) => {
    const { email, number } = req.body;
    console.log(email, number);
    try{
        if(email || number){
            const collection = db.collection("member");
            let result = await collection.findOne({
                $and: [
                    {email: email},
                    {number: number}
                ]
            });
            let password;
            if(result !== null){
                password = result.password;
                console.log(password);
                res.status(200).json({
                    status: "success",
                    data: password
                });
            }else{
                res.status(200).json({
                    status: "fail",
                    data: "找不到此帳號或手機號碼"
                })
            }  
        }else{
            res.status(404).json({
                status: "fail",
                message: "請填寫正確的帳號和手機號碼"
            })
        }
    }catch{
        res.status(500).json({
            status: "fail",
            message: "伺服器錯誤"
        })
    }
});
app.get("*", (req, res) => {
    res.status(404).send("404 Not Found");
});
app.listen(PORT, () => {
    console.log(`啟動伺服器localhost${PORT}`);
});
