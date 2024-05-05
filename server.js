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

//依賴配置
const express = require("express");
const app = express();
const session = require("express-session");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const PORT = 3000;
app.set("view engine", "ejs");
app.set("views", "./views");
app.use(session({
    secret: "key",
    resave: false,
    saveUninitialized: true
}));
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"]
}));
app.use(express.json());
let todos = [];

async function loadTodo(){
    try{
        const collection = db.collection("todos");
        todos = await collection.find({}).toArray();  
    }catch(err){
        console.log(err);
    }
} 
//路由配置
app.get("/", async (req, res) => {
    try{
        await loadTodo();
        res.status(200).json({
            status: "success",
            data: todos
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
        const { title } = req.body;
        if(title){
            const collection = db.collection("todos");
            await collection.insertOne({
                id: uuidv4(),
                title,
                done: false
            });
            await loadTodo();
            res.status(200).json({
                status: "success",
                data: todos
            });   
        }else{
            res.status(400).json({
                status: "fail",
                message: "需要填寫待辦事項"
            });
        }
    }catch{
        res.status(500).json({
            status: "fail",
            message: "資料庫連結錯誤"
        });
    }
})
app.delete("/:id", async (req, res) => {
    const id = req.params.id;
    if(id == "" || id == undefined || id == null){
        return;
    }
    try{
        const collection = db.collection("todos");
        await collection.deleteOne({
            id: id
        })
        await loadTodo();
        res.status(200).json({
            status: "success",
            data: todos
        });
    }catch{
        res.status(404).json({
            status: "fail",
            message: "找不到要刪除的資料"
        });
    }
});
app.patch("/:id/title", async(req, res) => {
    const id = req.params.id;
    const {title} = req.body;
    if(!id || !title){
        res.status(400).json({
            status: "fail",
            message: "請填入需更改的資料"
        })
        return;
    }
    try{
        const collection = db.collection("todos");
        await collection.updateOne(
            {
                id: id
            },{
                $set: {
                    title: title
                }
            }
        );
        await loadTodo();
        res.status(200).json({
            status: "success",
            data: todos
        })
    }catch{
        res.status(404).json({
            status: "fail",
            message: "找不到該資料"
        })
    }
})
app.patch("/:id/done", async (req, res) => {
    const id = req.params.id;
    try{
        const collection = db.collection("todos");
        let result = await collection.findOne({
            id: id
        })
        if(result.done){
            await collection.updateOne(
                {
                    id: id
                },{
                    $set: {
                        done: false
                    }
                }
            )
        }else{
            await collection.updateOne(
                {
                    id: id
                },{
                    $set: {
                        done: true
                    }
                }
            )
        }  
        await loadTodo();
        res.status(200).json({
            status: "success",
            data: todos
        });
    }catch{
        res.status(404).json({
            status: "fail",
            message: "找不到要更新的資料"
        });
    }
});

app.listen(PORT, () => {
    console.log(`正在聆聽localhost${PORT}`);
});