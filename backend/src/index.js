const express = require('express');
const app = express();
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// error hander
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');


const port= process.env.PORT||5000;

app.use(cors());
app.use(helmet());
app.use(express.json());
app.get('/status',(req,res)=>{
    res.json({status:'OK',message:'Server is running'});

});

// database
const prisma= require('./config/db');

async function main()
{
    await prisma.$connect();
    console.log('Database connected Succesfully');
}
main().catch((err)=>{
    console.log('Database cannot connected / connection failed',err);
    process.exit(1);
});

//authroutes

const authRoutes=require('./routes/auth.routes');
app.use('/api/auth',authRoutes);

// platform routes
const platformRoutes = require('./routes/platform.routes');
app.use('/api/platforms', platformRoutes);


//stats routes
const statsRoutes = require('./routes/stats.routes');

app.use('/api/stats', statsRoutes);

// leaderboard routes
const leaderboardRoutes = require('./routes/leaderboard.routes');

app.use('/api/leaderboard', leaderboardRoutes);

//verification
const verificationRoutes = require('./routes/verification.routes');

app.use('/api/verify', verificationRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(port,()=>{
    console.log(`Server has connected to port at:${port}`)
});
