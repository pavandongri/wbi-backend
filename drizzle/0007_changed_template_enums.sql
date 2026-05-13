ALTER TABLE "templates" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."template_category";--> statement-breakpoint
CREATE TYPE "public"."template_category" AS ENUM('MARKETING', 'UTILITY');--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "category" SET DATA TYPE "public"."template_category" USING "category"::"public"."template_category";--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "header_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."template_header_type";--> statement-breakpoint
CREATE TYPE "public"."template_header_type" AS ENUM('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION', 'NONE');--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "header_type" SET DATA TYPE "public"."template_header_type" USING "header_type"::"public"."template_header_type";
