ALTER TABLE transcript_segments 
ADD CONSTRAINT unique_segment 
UNIQUE (start_time, end_time, text);
