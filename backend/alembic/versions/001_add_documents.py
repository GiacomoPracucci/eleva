"""Add document tables with pgvector support

Revision ID: 001_add_documents
Revises: 
Create Date: 2024-01-01 00:00:00.000000

This migration adds the necessary tables for document storage and vector search:
- documents: Main document metadata and processing status
- document_chunks: Text chunks extracted from documents
- document_embeddings: Vector embeddings for similarity search

It also creates the pgvector extension and appropriate indexes for
efficient vector similarity search operations.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector
from typing import Union, Sequence

# revision identifiers, used by Alembic.
revision = '001_add_documents'
down_revision: Union[str, Sequence[str], None] = '45bc5e0d1181' 
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Create the pgvector extension and document-related tables.
    
    This migration performs the following operations:
    1. Enables the pgvector extension for vector operations
    2. Creates the documents table for document metadata
    3. Creates the document_chunks table for text segments
    4. Creates the document_embeddings table with vector columns
    5. Adds appropriate indexes for performance
    """
    
    # Enable pgvector extension
    # This is required for vector similarity search functionality
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    
    # Create the processing status enum type
    processing_status_enum = postgresql.ENUM(
        'pending', 'parsing', 'chunking', 'embedding', 'completed', 'failed',
        name='processingstatus'
    )
    processing_status_enum.create(op.get_bind())
    
    # Create documents table
    op.create_table(
        'documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=True),
        sa.Column('total_chunks', sa.Integer(), nullable=True, default=0),
        sa.Column('processing_status', processing_status_enum, nullable=False, server_default='pending'),
        sa.Column('processing_error', sa.Text(), nullable=True),
        sa.Column('processing_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processing_completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata_', sa.JSON(), nullable=True, default={}),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    # Create indexes for documents table
    op.create_index('ix_documents_id', 'documents', ['id'])
    op.create_index('ix_documents_subject_id', 'documents', ['subject_id'])
    op.create_index('ix_documents_owner_id', 'documents', ['owner_id'])
    op.create_index('ix_documents_processing_status', 'documents', ['processing_status'])
    
    # Create document_chunks table
    op.create_table(
        'document_chunks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('chunk_text', sa.Text(), nullable=False),
        sa.Column('start_char', sa.Integer(), nullable=True),
        sa.Column('end_char', sa.Integer(), nullable=True),
        sa.Column('metadata_', sa.JSON(), nullable=True, default={}),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    )
    
    # Create indexes for document_chunks table
    op.create_index('ix_document_chunks_id', 'document_chunks', ['id'])
    op.create_index('ix_document_chunks_document_id', 'document_chunks', ['document_id'])
    # Composite index for efficient chunk ordering within a document
    op.create_index('ix_document_chunks_doc_index', 'document_chunks', ['document_id', 'chunk_index'])
    
    # Create document_embeddings table
    op.create_table(
        'document_embeddings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('chunk_id', sa.Integer(), nullable=False),
        sa.Column('embedding_vector', Vector(1536), nullable=False),  # Dimension for OpenAI ada-002
        sa.Column('model_name', sa.String(length=100), nullable=False, server_default='text-embedding-ada-002'),
        sa.Column('model_version', sa.String(length=50), nullable=True),
        sa.Column('embedding_dimension', sa.Integer(), nullable=False, server_default='1536'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['chunk_id'], ['document_chunks.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('chunk_id'),  # One embedding per chunk
    )
    
    # Create indexes for document_embeddings table
    op.create_index('ix_document_embeddings_id', 'document_embeddings', ['id'])
    op.create_index('ix_document_embeddings_chunk_id', 'document_embeddings', ['chunk_id'])
    
    # Create vector similarity search index using IVFFlat
    # This index significantly speeds up similarity searches
    # We use vector_cosine_ops for cosine similarity (most common for text)
    # Note: For production with >1M vectors, consider using HNSW instead
    op.execute("""
        CREATE INDEX ix_document_embeddings_vector 
        ON document_embeddings 
        USING ivfflat (embedding_vector vector_cosine_ops)
        WITH (lists = 100);
    """)
    
    print("✅ Document tables created successfully with pgvector support")


def downgrade() -> None:
    """
    Remove document-related tables and the pgvector extension.
    
    This will completely remove all document storage functionality.
    WARNING: This operation will delete all uploaded documents and their embeddings.
    """
    
    # Drop indexes first (in reverse order of creation)
    op.execute('DROP INDEX IF EXISTS ix_document_embeddings_vector')
    op.drop_index('ix_document_embeddings_chunk_id', table_name='document_embeddings')
    op.drop_index('ix_document_embeddings_id', table_name='document_embeddings')
    
    op.drop_index('ix_document_chunks_doc_index', table_name='document_chunks')
    op.drop_index('ix_document_chunks_document_id', table_name='document_chunks')
    op.drop_index('ix_document_chunks_id', table_name='document_chunks')
    
    op.drop_index('ix_documents_processing_status', table_name='documents')
    op.drop_index('ix_documents_owner_id', table_name='documents')
    op.drop_index('ix_documents_subject_id', table_name='documents')
    op.drop_index('ix_documents_id', table_name='documents')
    
    # Drop tables (in reverse order due to foreign key constraints)
    op.drop_table('document_embeddings')
    op.drop_table('document_chunks')
    op.drop_table('documents')
    
    # Drop the enum type
    processing_status_enum = postgresql.ENUM(
        'pending', 'parsing', 'chunking', 'embedding', 'completed', 'failed',
        name='processingstatus'
    )
    processing_status_enum.drop(op.get_bind())
    
    # Note: We don't drop the pgvector extension as other tables might use it
    # If you want to remove it completely, uncomment the following line:
    # op.execute('DROP EXTENSION IF EXISTS vector')
    
    print("✅ Document tables removed successfully")