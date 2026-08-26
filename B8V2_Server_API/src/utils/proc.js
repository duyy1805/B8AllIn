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

function isDeadlock(error) {
  return Number(error?.number || error?.originalError?.info?.number) === 1205;
}

async function execProcWithDeadlockRetry(name, inputs={}, maxAttempts=3) {
  let lastError;
  for (let attempt=1; attempt<=maxAttempts; attempt+=1) {
    try {
      return await execProc(name, inputs);
    } catch(error) {
      lastError=error;
      if (!isDeadlock(error) || attempt===maxAttempts) throw error;
      await new Promise(resolve=>setTimeout(resolve,attempt*75));
    }
  }
  throw lastError;
}

module.exports={execProc,execProcWithDeadlockRetry};
