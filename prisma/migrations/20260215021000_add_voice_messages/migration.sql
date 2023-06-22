-- Voice messages: store audio URL + optional transcript.

ALTER TABLE "messages" ADD COLUMN "audioUrl" TEXT;
ALTER TABLE "messages" ADD COLUMN "audioTranscript" TEXT;

