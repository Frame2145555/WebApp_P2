const express = require('express');
const path = require('path');
const argon2 = require('@node-rs/argon2')
const con = require('./db');
// const { use } = require('react');

//set stacic folder

//allow json exchange
const app = express();

//generate a hashed password
app.get('/password/:raw', function (req, res) {
    const raw = req.params.raw;
    const hash = argon2.hashSync(raw);
    console.log(hash.length);
    res.status(200).send(hash);
})

// allow json exchan
app.use(express.json());

// login to system  
app.post('/login', function (req, res) {
    // const username =  req.body.username;
    // const password = req.body.password;

    const { username, password } = req.body;
    // console.log(username, password);
    // res.end();

    //SQL injextion
    // const sql = `SELECT id, role FROM creat_tabel WHERE username = ${username} AND password = ${password};`; ห้ามเขียนแบบนี้

    //New SQL
    //const sql = "SELECT id, role FROM creat_tabel WHERE username = ? AND password = ?;";
    const sql = "SELECT id, password, role FROM user_table WHERE username = ?;";
    con.query(sql, [username], function (err, results) {
        //server error
        if (err) {
            console.log(err);
            return res.status(500).send("Server Error");
        }

        //if wrong username
        if (results.length !== 1) {
            return res.status(401).send("Worng username");
        }

        //if wrong password
        const same = argon2.verifySync(results[0].password, password);
        if (same !== true) {
            return res.status(401).send('Wrong password')
        }

        // login ok
        if(results[0].role === "admin"){
            res.status(200).send('/admin/inventory');
        }else if(results[0].role === "user"){
            res.status(200).send('/shop');
        }
        
        
        //Case if else
    
        // if(err){
        //     console.log(err);
        //     res.status(500).send("Server Error");
        // }else{
        //     //if resulte has 1 item => this user exists
        //     if(results.length === 1){
        //         //res.status(200).send("Login OK")

        //         //check raw password with the hashed password
        //         const same = argon2.verifySync(results[0].password, password);
        //         if(same === true){
        //             res.status(200).send('Login OK')
        //         }else{
        //             res.status(401).send('Wrong password')
        //         }
        //     }else{
        //         res.status(401).send("Worng username")
        //     }
        // }
    })
});

//==================================== page routes ======================================
//inventory page
app.get('/admin/inventory', function (req, res) {
    res.status(200).sendFile(path.join(__dirname, 'views/inventory.html'));
});

//root sevice
app.get('/', function (req, res) {
    res.status(200).sendFile(path.join(__dirname, 'views/login.html')); //__dirname = root foder
});

app.listen(3000, function () {
    console.log('Sever is running at 3000');
});
