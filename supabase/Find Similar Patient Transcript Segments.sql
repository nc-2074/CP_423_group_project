CREATE OR REPLACE FUNCTION match_patient_segments(
    query_embedding VECTOR(384),
    match_count INT
)
RETURNS TABLE (
    id UUID,
    speaker TEXT,
    role TEXT,
    start_time FLOAT,
    end_time FLOAT,
    text TEXT,
    similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        id,
        speaker,
        role,
        start_time,
        end_time,
        text,
        1 - (embedding <=> query_embedding) AS similarity
    FROM transcript_segments
    WHERE role = 'PATIENT'
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;
