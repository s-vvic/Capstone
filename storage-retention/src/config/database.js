   import pg from 'pg';
   import { databaseOptions } from '../../../shared/config.mjs';
   import dotenv from 'dotenv';

   dotenv.config();

   const { Pool } = pg;

   export const pool = new Pool({
     ...databaseOptions(),
   });

   pool.on('error', (err) => {
     console.error('예상치 못한 DB 에러:', err);
   });