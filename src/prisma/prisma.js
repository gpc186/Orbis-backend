const { PrismaClient } = require('@prisma/client');
const prismaRaw = new PrismaClient();

const MAX_RETRIES = 4;
const INITIAL_DELAY = 1000;

/** @type {PrismaClient} */
const prisma = prismaRaw.$extends({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }){
                let lastError;
                for(let attempt = 1; attempt <= MAX_RETRIES; attempt++){
                    try {
                        return await query(args);
                    } catch (error) {
                        lastError = error;
                        const isConnectionError = error.code === 'P1001' || error.code === 'P1017' || error.message.includes('timeout');

                        if(isConnectionError && attempt < MAX_RETRIES){
                            await prismaRaw.$disconnect();
                            const delay = INITIAL_DELAY * Math.pow(2, attempt - 1) + Math.random() * 1000;
                            
                            console.warn(`[Prisma] Tentativa ${attempt} falhou em ${model}.${operation}. Tentando em ${delay}ms...`);

                            await new Promise((resolve) => setTimeout(resolve, delay));
                            continue
                        };

                        throw error;
                    }
                }
                throw lastError
            }
        }
    }
})

module.exports = prisma;