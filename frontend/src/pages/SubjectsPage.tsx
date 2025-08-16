import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Plus, 
  BookOpen, 
  Edit2, 
  Trash2, 
  X, 
  Calendar,
  Tag,
  Archive,
  MoreVertical,
  GraduationCap
} from 'lucide-react';
import clsx from 'clsx';
import api from '@/services/api';
import { Subject, SubjectCreate } from '@/types';

// Colori predefiniti per i subjects
const COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#14B8A6', // teal
  '#F97316', // orange
  '#EF4444', // red
];

// Icone disponibili
const ICONS = [
  { name: 'book', icon: '📚' },
  { name: 'math', icon: '🔢' },
  { name: 'science', icon: '🔬' },
  { name: 'language', icon: '💬' },
  { name: 'computer', icon: '💻' },
  { name: 'art', icon: '🎨' },
  { name: 'music', icon: '🎵' },
  { name: 'sport', icon: '⚽' },
];

const SubjectsPage = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SubjectCreate>();

  const selectedColor = watch('color') || COLORS[0];
  const selectedIcon = watch('icon') || ICONS[0].name;

  // Carica i subjects all'avvio
  useEffect(() => {
    fetchSubjects();
  }, [showArchived]);

  // Funzione per caricare i subjects
  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Subject[]>('/subjects', {
        params: { include_archived: showArchived }
      });
      setSubjects(response.data);
      setError(null);
    } catch (error: any) {
      setError('Failed to load subjects');
      console.error('Error fetching subjects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Apri modal per nuovo subject o modifica
  const openModal = (subject?: Subject) => {
    if (subject) {
      setEditingSubject(subject);
      // Popola il form con i dati esistenti
      Object.keys(subject).forEach((key) => {
        setValue(key as any, (subject as any)[key]);
      });
    } else {
      setEditingSubject(null);
      reset({
        color: COLORS[0],
        icon: ICONS[0].name,
      });
    }
    setIsModalOpen(true);
  };

  // Chiudi modal
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSubject(null);
    reset();
  };

  // Submit del form
  const onSubmit = async (data: SubjectCreate) => {
    try {
      if (editingSubject) {
        // Update
        const response = await api.put<Subject>(
          `/subjects/${editingSubject.id}`,
          data
        );
        setSubjects(subjects.map(s => 
          s.id === editingSubject.id ? response.data : s
        ));
      } else {
        // Create
        const response = await api.post<Subject>('/subjects', data);
        setSubjects([...subjects, response.data]);
      }
      closeModal();
    } catch (error: any) {
      console.error('Error saving subject:', error);
      setError(error.response?.data?.detail || 'Failed to save subject');
    }
  };

  // Elimina subject
  const deleteSubject = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this subject?')) {
      return;
    }

    setDeletingSubjectId(id);
    try {
      await api.delete(`/subjects/${id}`);
      setSubjects(subjects.filter(s => s.id !== id));
    } catch (error: any) {
      console.error('Error deleting subject:', error);
      setError('Failed to delete subject');
    } finally {
      setDeletingSubjectId(null);
    }
  };

  // Toggle archive status
  const toggleArchive = async (subject: Subject) => {
    try {
      const response = await api.put<Subject>(
        `/subjects/${subject.id}`,
        { is_archived: !subject.is_archived }
      );
      setSubjects(subjects.map(s => 
        s.id === subject.id ? response.data : s
      ));
    } catch (error: any) {
      console.error('Error updating subject:', error);
      setError('Failed to update subject');
    }
  };

  // Componente Card del Subject
  const SubjectCard = ({ subject }: { subject: Subject }) => {
    const [showMenu, setShowMenu] = useState(false);
    const icon = ICONS.find(i => i.name === subject.icon)?.icon || '📚';

    return (
      <div 
        className={clsx(
          "bg-white rounded-xl shadow-sm border-2 p-6 relative transition-all hover:shadow-md",
          subject.is_archived && "opacity-60"
        )}
        style={{ borderColor: subject.color || '#e5e7eb' }}
      >
        {/* Menu dropdown */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => {
                  openModal(subject);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </button>
              <button
                onClick={() => {
                  toggleArchive(subject);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
              >
                <Archive className="w-4 h-4 mr-2" />
                {subject.is_archived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                onClick={() => {
                  deleteSubject(subject.id);
                  setShowMenu(false);
                }}
                disabled={deletingSubjectId === subject.id}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Subject content */}
        <div className="flex items-start space-x-4">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${subject.color}20` }}
          >
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {subject.name}
            </h3>
            {subject.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {subject.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {subject.level && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  <GraduationCap className="w-3 h-3 mr-1" />
                  {subject.level}
                </span>
              )}
              {subject.academic_year && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  <Calendar className="w-3 h-3 mr-1" />
                  {subject.academic_year}
                </span>
              )}
              {subject.category && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  <Tag className="w-3 h-3 mr-1" />
                  {subject.category}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Subjects</h1>
          <p className="text-gray-600 mt-1">
            Manage your academic subjects and track your progress
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              showArchived 
                ? "bg-gray-200 text-gray-900" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <Archive className="w-4 h-4 inline mr-2" />
            {showArchived ? 'Hide' : 'Show'} Archived
          </button>
          <button
            onClick={() => openModal()}
            className="btn-primary inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Subject
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : subjects.length === 0 ? (
        /* Empty state */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {showArchived ? 'No archived subjects' : 'No subjects yet'}
            </h2>
            <p className="text-gray-600 mb-6">
              {showArchived 
                ? 'You haven\'t archived any subjects yet'
                : 'Start by adding your first subject to track your learning progress'}
            </p>
            {!showArchived && (
              <button
                onClick={() => openModal()}
                className="btn-primary inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Subject
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Subjects grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      )}

      {/* Modal for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Name *
                </label>
                <input
                  {...register('name', { required: 'Subject name is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Mathematics, Physics, Literature"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief description of the subject..."
                />
              </div>

              {/* Academic Year and Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Academic Year
                  </label>
                  <input
                    {...register('academic_year')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 2024-2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Level
                  </label>
                  <input
                    {...register('level')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Grade 11, Year 2"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  {...register('category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a category</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="Languages">Languages</option>
                  <option value="Social Studies">Social Studies</option>
                  <option value="Arts">Arts</option>
                  <option value="Technology">Technology</option>
                  <option value="Physical Education">Physical Education</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Theme
                </label>
                <div className="flex space-x-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setValue('color', color)}
                      className={clsx(
                        "w-10 h-10 rounded-lg border-2 transition-all",
                        selectedColor === color
                          ? "border-gray-800 scale-110"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {ICONS.map(({ name, icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setValue('icon', name)}
                      className={clsx(
                        "p-3 rounded-lg border-2 text-2xl transition-all hover:bg-gray-50",
                        selectedIcon === name
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200"
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={clsx(
                    "px-6 py-2 rounded-lg font-medium text-white transition-colors",
                    isSubmitting
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  )}
                >
                  {isSubmitting ? 'Saving...' : editingSubject ? 'Update' : 'Create'} Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectsPage;