import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      {/* Test classi standard */}
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">
          Tailwind v4 + Vite ✨
        </h1>
        
        {/* Test valori arbitrari */}
        <div className="bg-[#8B5CF6] text-white p-[18px] rounded-[12px]">
          Valori arbitrari funzionano senza config!
        </div>
        
        {/* Test utility custom */}
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Card Custom</h2>
          <div className="space-x-4">
            <button className="btn-primary">
              Primary
            </button>
            <button className="btn-secondary">
              Secondary
            </button>
          </div>
        </div>
        
        {/* Test animazione */}
        <div className="card animate-slide-up">
          <p className="text-gray-600">
            Questa card ha un'animazione di entrata!
          </p>
        </div>
        
        {/* Test responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-blue-100 p-4 rounded">Col 1</div>
          <div className="bg-purple-100 p-4 rounded">Col 2</div>
          <div className="bg-teal-100 p-4 rounded">Col 3</div>
        </div>
      </div>
    </div>
  )
}

export default App