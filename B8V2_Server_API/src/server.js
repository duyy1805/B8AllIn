const app=require('./app');
const env=require('./config/env');
const {getPool}=require('./config/db');

(async()=>{
  try{
    await getPool();
    console.log('SQL Server connected.');
    app.listen(env.port,()=>console.log(`B8V2 API listening on port ${env.port}`));
  }catch(err){
    console.error('Startup failed:',err);
    process.exit(1);
  }
})();
