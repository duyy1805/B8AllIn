const express=require('express');
const cors=require('cors');
const morgan=require('morgan');
const errorHandler=require('./middleware/errorHandler');

const app=express();
app.use(cors());
app.use(express.json({limit:'5mb'}));
app.use(express.urlencoded({extended:true}));
app.use(morgan('dev'));

app.get('/api/health',(req,res)=>res.json({success:true,service:'B8V2 API',time:new Date().toISOString()}));

app.use('/api/auth',require('./modules/auth/auth.routes'));
app.use('/api/master',require('./modules/master/master.routes'));
app.use('/api/roles',require('./modules/roles/role.routes'));
app.use('/api/processes',require('./modules/processes/process.routes'));
app.use('/api/process-versions',require('./modules/processes/processVersion.routes'));
app.use('/api/process-training-evidence',require('./modules/processes/processTraining.routes'));
app.use('/api/products',require('./modules/products/product.routes'));
app.use('/api/product-documents',require('./modules/products/document.routes'));
app.use('/api/product-document-versions',require('./modules/products/documentVersion.routes'));
app.use('/api/product-training-evidence',require('./modules/products/productTraining.routes'));
app.use('/api/files',require('./modules/files/file.routes'));
app.use('/api/feedback',require('./modules/feedback/feedback.routes'));
app.use('/api/dashboard',require('./modules/dashboard/dashboard.routes'));

app.use((req,res)=>res.status(404).json({success:false,message:'Route not found'}));
app.use(errorHandler);

module.exports=app;
