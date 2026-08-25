const {getPool,sql}=require('../config/db');

const TYPES={
  int:sql.Int,bigint:sql.BigInt,bit:sql.Bit,date:sql.Date,
  varchar:sql.VarChar,nvarchar:sql.NVarChar
};

async function execProc(name, inputs={}) {
  const pool=await getPool();
  const request=pool.request();
  for (const [key,spec] of Object.entries(inputs)) {
    const type=spec.type ? TYPES[spec.type] : undefined;
    if (type) request.input(key,type,spec.value ?? null);
    else request.input(key,spec.value ?? null);
  }
  return request.execute(name);
}
module.exports={execProc};
