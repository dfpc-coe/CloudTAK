ALTER TABLE "core_event" RENAME TO "core_entity";--> statement-breakpoint
ALTER TABLE "core_event_channel" RENAME TO "core_entity_channel";--> statement-breakpoint
ALTER TABLE "core_event_board" RENAME TO "core_entity_board";--> statement-breakpoint
ALTER TABLE "core_event_board_column" RENAME TO "core_entity_board_column";--> statement-breakpoint
ALTER TABLE "core_event_board_event" RENAME TO "core_entity_board_event";--> statement-breakpoint
ALTER TABLE "core_event_assignment" RENAME TO "core_entity_assignment";--> statement-breakpoint
ALTER TABLE "core_event_effect" RENAME TO "core_entity_effect";--> statement-breakpoint
ALTER TABLE "core_event_response" RENAME TO "core_entity_response";--> statement-breakpoint
ALTER INDEX "core_event_connection_external_id_idx" RENAME TO "core_entity_connection_external_id_idx";--> statement-breakpoint
ALTER INDEX "core_event_board_channel_idx" RENAME TO "core_entity_board_channel_idx";--> statement-breakpoint
ALTER INDEX "core_event_board_column_board_idx" RENAME TO "core_entity_board_column_board_idx";--> statement-breakpoint
ALTER INDEX "core_event_assignment_event_uid_idx" RENAME TO "core_entity_assignment_event_uid_idx";--> statement-breakpoint
ALTER TABLE "core_entity" RENAME CONSTRAINT "core_event_pkey" TO "core_entity_pkey";--> statement-breakpoint
ALTER TABLE "core_entity" RENAME CONSTRAINT "core_event_username_profile_username_fk" TO "core_entity_username_profile_username_fk";--> statement-breakpoint
ALTER TABLE "core_entity" RENAME CONSTRAINT "core_event_connection_connections_id_fk" TO "core_entity_connection_connections_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_channel" RENAME CONSTRAINT "core_event_channel_event_channel_pk" TO "core_entity_channel_event_channel_pk";--> statement-breakpoint
ALTER TABLE "core_entity_channel" RENAME CONSTRAINT "core_event_channel_event_core_event_id_fk" TO "core_entity_channel_event_core_entity_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_board" RENAME CONSTRAINT "core_event_board_pkey" TO "core_entity_board_pkey";--> statement-breakpoint
ALTER TABLE "core_entity_board_column" RENAME CONSTRAINT "core_event_board_column_pkey" TO "core_entity_board_column_pkey";--> statement-breakpoint
ALTER TABLE "core_entity_board_column" RENAME CONSTRAINT "core_event_board_column_board_core_event_board_id_fk" TO "core_entity_board_column_board_core_entity_board_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_pkey" TO "core_entity_board_event_pkey";--> statement-breakpoint
ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_board_event_unique" TO "core_entity_board_event_board_event_unique";--> statement-breakpoint
ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_board_core_event_board_id_fk" TO "core_entity_board_event_board_core_entity_board_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_column_core_event_board_column_id_fk" TO "core_entity_board_event_column_core_entity_board_column_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_event_core_event_id_fk" TO "core_entity_board_event_event_core_entity_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_assignment" RENAME CONSTRAINT "core_event_assignment_pkey" TO "core_entity_assignment_pkey";--> statement-breakpoint
ALTER TABLE "core_entity_assignment" RENAME CONSTRAINT "core_event_assignment_event_core_event_id_fk" TO "core_entity_assignment_event_core_entity_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_assignment" RENAME CONSTRAINT "core_event_assignment_uid_profile_username_fk" TO "core_entity_assignment_uid_profile_username_fk";--> statement-breakpoint
ALTER TABLE "core_entity_effect" RENAME CONSTRAINT "core_event_effect_pkey" TO "core_entity_effect_pkey";--> statement-breakpoint
ALTER TABLE "core_entity_effect" RENAME CONSTRAINT "core_event_effect_event_core_event_id_fk" TO "core_entity_effect_event_core_entity_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_effect" RENAME CONSTRAINT "core_event_effect_device_core_device_id_fk" TO "core_entity_effect_device_core_device_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_response" RENAME CONSTRAINT "core_event_response_event_response_pk" TO "core_entity_response_event_response_pk";--> statement-breakpoint
ALTER TABLE "core_entity_response" RENAME CONSTRAINT "core_event_response_event_core_event_id_fk" TO "core_entity_response_event_core_entity_id_fk";--> statement-breakpoint
ALTER TABLE "core_entity_response" RENAME CONSTRAINT "core_event_response_response_core_form_response_id_fk" TO "core_entity_response_response_core_form_response_id_fk";--> statement-breakpoint
ALTER TABLE "core_device" RENAME CONSTRAINT "core_device_event_core_event_id_fk" TO "core_device_event_core_entity_id_fk";--> statement-breakpoint
ALTER TABLE "core_form_column" RENAME CONSTRAINT "core_form_column_column_core_event_board_column_id_fk" TO "core_form_column_column_core_entity_board_column_id_fk";
