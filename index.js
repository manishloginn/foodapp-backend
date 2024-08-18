const express = require('express')
require('dotenv').config()
const mongoose = require('mongoose')
const { registerChecker } = require('./utils/registerUtil')
var cors = require('cors')
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;
const session = require('express-session')
const mongoDbSession = require('connect-mongodb-session')(session)
const multer = require('multer')
const path = require('path');






const RegisterUser = require('./Schema/RegisterUser')
const { loginUtil } = require('./utils/loginUtil')
const isAuth = require('./authUtils/adminauth')
const FoodProduct = require('./Schema/FoodProduct')



const port = process.env.PORT || 5000
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }));
// app.use('./uploads', express.static('uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));






mongoose.connect(process.env.MongoLink)
    .then((res) => {
        console.log('Connected to MongoDB')
    })
    .catch(err => console.err)



const store = new mongoDbSession({
    uri: process.env.MongoLink,
    collection: "session",

})

app.use(session({
    store: store,
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
}))


app.post('/', (req, res) => {
    res.send('homepage')
})

app.get("/", (req, res) => {
    res.send('Welcome')
})

app.post('/registerUser', async (req, res) => {
    const { username, name, email, password, contact } = req.body
    console.log(req.body)


    try {
        await registerChecker({ username, name, email, password, contact })
        let existingUser = await RegisterUser.findOne({
            $or: [
                { email: email },
                { username: username }
            ]
        })
        if (existingUser) {
            return res.send({
                status: 400,
                message: 'User already exists'
            })
        }
    } catch (error) {
        console.log(error)
    }

    let userDb;

    try {
        userDb = new RegisterUser({ username, name, email, password, contact })
        res.status(200).json('successfully registered')
    } catch (error) {
        console.log(error)
    }

    await userDb.save()
})



app.post('/loginUser', async (req, res) => {
    const { username, password } = req.body;
    console.log(username, password)
    try {
        await loginUtil({ username, password })
    } catch (error) {
        console.log(error)
    }

    let findDb;
    try {
        findDb = await RegisterUser.findOne({
            $or: [
                { username: username },
                { email: username }
            ]
        })

        if (!findDb) {
            return res.status(404).json({
                status: 404,
                message: 'User not found'
            })
        }
        console.log(findDb)

        return res.send({
            status: 200,
            message: 'Logged in successfully',
            user: findDb
        })

    } catch (error) {
        console.log(error)
    }
})

const adminSchema = new Schema({
    username: String,
    restrauntName:String,
    password: String,
    address: String,
    isAdminAuth: Boolean,

})
const adminModel = mongoose.model('admin', adminSchema)

app.post('/adminRegister', async (req, res) => {

    const { username, password, restrauntName, address } = req.body;

  
    try {
        const existingAdmin = await adminModel.findOne({ username })

        if (existingAdmin) {
            return res.status(400).json({
                status: 400,
                message: 'Admin already exists'
            })
        }
    } catch (error) {
        res.send({
            status: 500,
            message: 'An error occurred while checking for existing admin'
        })
    }

    try {
        const hashPassword = await bcrypt.hash(password, 10)
        const adminDb = new adminModel({
            username,
            restrauntName,
            address,
            password: hashPassword,
            isAdminAuth: false,
        })

        console.log(adminDb)

        await adminDb.save()
        console.log('Admin registered successfully');
        res.status(201).json({ message: 'Admin registered successfully' });

    } catch (error) {
        console.error(err);
        res.status(500).json({ message: 'An error occurred while registering the admin' });
    }
})


app.post('/registerEmail', (req, res) => {
    const email = req.body.email;
    console.log(email)
} )

app.post('/adminDone', async (req, res) => {
    const { username, password } = req.body

    try {
        const admin = await adminModel.findOne({ username })
        if (!admin) {
            return res.status(404).json({
                status: 404,
                message: 'Admin not found'
            })
        }

        const comparepassword = bcrypt.compare(password, admin.password);

        if (!comparepassword) {
            res.send({
                status: 404,
                message: 'Invalid password'
            })
        }
        console.log(admin)

        req.session.isAuth = true;
        req.session.userDetails = {
            username: admin.username,
            restrauntName: admin.restrauntName,
            address: admin.address,
            isAdminAuth: true
        }

        admin.isAdminAuth = true

        res.send({
            status: 200,
            message: 'Admin authenticated successfully',
            user: admin
        })
    } catch (error) {
        console.log(error)
    }

})

app.post('/adminLogout', (req, res) => {
    req.session.destroy((err) => {
        if(err) {
            return res.send({
                status: 500,
                message: 'Session destroy error'
            })
        }
        res.send({
            status: 200,
            message: 'Logged out successfully'
        })
    })
})


const storage = multer.diskStorage({
    destination: (req, res, cb) => {
        cb(null, ("uploads"))
    },
    filename: (req, res, cb) => {
        cb(null, Date.now() + res.originalname);
    }
});

const upload = multer({ 
    storage: storage
 }).single('imageTest')


app.post('/uploadData', upload, (req, res) => {
    
    const {username, restrauntName , address } = req.session.userDetails

    console.log(req.file)
    try {
        const itemData = new FoodProduct ({
            image: req.file.path,
            category: req.body.category,
            name: req.body.name,
            description: req.body.description,
            price: req.body.price,
            username: username,
            restrauntName: restrauntName,
            address: address,
        })
        
        console.log(itemData)
        itemData.save()
        .then(() => {
            res.send({ message: 'File uploaded successfully', data: itemData });
        })
        .catch((error) => {
            console.error('Error while saving data:', error);
            res.status(500).send('Error while saving data');
        });
    
    } catch (error) {
        res.send('Error while uploading')
    }
  
})

app.post('/deleteItem', async(req, res) => {
    const { id } = req.body

    console.log(id)

    try {
        const data = await FoodProduct.findByIdAndDelete({_id : id})
        console.log(data)
        res.send({
            status: 200,
            message: 'Item deleted successfully',
            data: data
        })
    } catch (error) {
        console.log(error)
    }
})



app.get('/admin/Dashboard', (req, res) => {
    if (!req.session.isAuth) {
        return res.send({   
            status: 401,
            message: 'Not authenticated'
        })
    }
    res.send('Add Product Page')
})


app.get('/getProduct', async (req, res) => {
    try {
        const product = await FoodProduct.find();
        res.status(200).json(product)
    } catch (error) {
        res.send({
            status: 404,
            message: 'No product found'
        })
    }
})

app.get('/getRestrauntFood', async (req, res) => {
    const { username } = req.session.userDetails

    try {
        const product = await FoodProduct.find({ username })
        res.send({
            status: 200,
            message: 'Food items fetched successfully',
            data: product
        })
        console.log(product)
    } catch (error) {
        console.log(error)
    }
} )




app.listen(port, () => {
    console.log(`Starting server on port ${port}`)
})
