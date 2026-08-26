const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions}=require('../../middleware/auth');

router.use(authRequired);

router.post('/upsert',requirePermissions('PRODUCT_MANAGE'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_Product_Upsert',{
    ItemCode:{type:'nvarchar',value:b.itemCode},ProductName:{type:'nvarchar',value:b.productName||null},
    ModelCode:{type:'nvarchar',value:b.modelCode||null},CustomerCode:{type:'nvarchar',value:b.customerCode||null},
    CustomerName:{type:'nvarchar',value:b.customerName||null},ProductLine:{type:'nvarchar',value:b.productLine||null},
    Category:{type:'nvarchar',value:b.category||null},UserId:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));

router.get('/:itemCode',requirePermissions('DOCUMENT_VIEW_ALL'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Product_GetDetailByItemCode',{ItemCode:{type:'nvarchar',value:req.params.itemCode}});
  res.json({success:true,data:{product:r.recordsets[0]?.[0]||null,documents:r.recordsets[1]||[]}});
}));
module.exports=router;
