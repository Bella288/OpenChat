-- Add user_id column to conversations table
ALTER TABLE "conversations" 
ADD COLUMN "user_id" integer;

-- Add foreign key constraint
ALTER TABLE "conversations" 
ADD CONSTRAINT "conversations_user_id_users_id_fk" 
FOREIGN KEY ("user_id") 
REFERENCES "users"("id") 
ON DELETE no action 
ON UPDATE no action;