import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getCities, getDistricts, getBarangays } from '../../data/location'
import { validateProfileForm, sanitizeInput } from '../../utils/validation'
import { logAuditEvent } from '../../utils/auditLog'
import { getCoordinates } from "../../utils/geocoding"
import { calculateAllRisks } from "../../utils/riskCalculator"

const housingIcons = {
  'Apartment': '/icons/housing/apartment.svg',
  'House': '/icons/housing/house.svg',
  'Coastal': '/icons/housing/coastal.svg',
  'Hillside': '/icons/housing/hillside.svg',
  'High-rise': '/icons/housing/highrise.svg'
}

export default function ProfileForm({ onSuccess, userName } = {}) {
  const firstName = userName ? userName.split(' ')[0] : null
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [availableDistricts, setAvailableDistricts] = useState([])
  const [availableBarangays, setAvailableBarangays] = useState([])
  const [profileExists, setProfileExists] = useState(false)

  const [formData, setFormData] = useState({
    city: '',
    district: '',
    barangay: '',
    housing_type: '',
    floor_level: 1,
    household_size: 1,
    has_children: false,
    has_elderly: false,
    has_pwd: false,
    has_pets: false,
    has_vehicle: false,
    medical_dependencies: false
  })

  useEffect(() => {
    loadExistingProfile()
  }, [])

  const loadExistingProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // PGRST116 = no rows found (new user), all other errors are real
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error)
        return
      }

      if (data) {
        setFormData({
          city: data.city || '',
          district: data.district || '',
          barangay: data.barangay || '',
          housing_type: data.housing_type || '',
          floor_level: data.floor_level || 1,
          household_size: data.household_size || 1,
          has_children: data.has_children || false,
          has_elderly: data.has_elderly || false,
          has_pwd: data.has_pwd || false,
          has_pets: data.has_pets || false,
          has_vehicle: data.has_vehicle || false,
          medical_dependencies: data.medical_dependencies || false
        })

        // Populate cascading dropdowns from saved data
        if (data.city) setAvailableDistricts(getDistricts(data.city))
        if (data.city && data.district) setAvailableBarangays(getBarangays(data.city, data.district))

        setProfileExists(true)
        setIsEditing(false)
      }

    } catch (error) {
      console.error('Error in loadExistingProfile:', error)
    }
  }

  const handleCityChange = (e) => {
    const selectedCity = e.target.value
    setFormData(prev => ({ ...prev, city: selectedCity, district: '', barangay: '' }))
    if (selectedCity) {
      setAvailableDistricts(getDistricts(selectedCity))
    } else {
      setAvailableDistricts([])
    }
    setAvailableBarangays([])
  }

  const handleDistrictChange = (e) => {
    const selectedDistrict = e.target.value
    setFormData(prev => ({ ...prev, district: selectedDistrict, barangay: '' }))
    if (formData.city && selectedDistrict) {
      setAvailableBarangays(getBarangays(formData.city, selectedDistrict))
    } else {
      setAvailableBarangays([])
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleNext = () => {
    // Validate Step 1
    if (currentStep === 1) {
      const missingFields = []

      if (!formData.city) missingFields.push('City')
      if (!formData.district) missingFields.push('District')
      if (!formData.barangay) missingFields.push('Barangay')
      if (!formData.housing_type) missingFields.push('Housing Type')

      if (missingFields.length > 0) {
        alert(`Please complete the following required fields:\n• ${missingFields.join('\n• ')}`)
        return
      }
    }

    // Validate Step 2
    if (currentStep === 2) {
      if (!formData.household_size || formData.household_size < 1) {
        alert('Please enter the number of people in your household (minimum 1)')
        return
      }
      if (formData.household_size > 50) {
        alert('Household size cannot exceed 50 people')
        return
      }
    }

    // Move to next step
    setCurrentStep(prev => prev + 1)
  }

  const handleBack = () => {
    setCurrentStep(prev => Math.max(1, prev - 1))
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const validation = validateProfileForm(formData)
      if (!validation.isValid) {
        alert('Validation errors:\n' + validation.errors.join('\n'))
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to save your profile')
        return
      }

      const sanitizedData = {
        ...formData,
        city: sanitizeInput(formData.city),
        district: sanitizeInput(formData.district),
        barangay: sanitizeInput(formData.barangay)
      }

      const coords = getCoordinates(sanitizedData.city, sanitizedData.district, sanitizedData.barangay)
      if (!coords) {
        alert('Could not find coordinates for this location. Please check your selection.')
        setLoading(false)
        return
      }

      // Log profile update
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: 'PROFILE_UPDATED',
          metadata: {
            city: sanitizedData.city,
            housing_type: sanitizedData.housing_type,
            household_size: sanitizedData.household_size
          }
        })
        .then(() => console.log('Profile update logged'))
        .catch(err => console.warn('Audit log error:', err))

      sanitizedData.lat = coords.latitude
      sanitizedData.lng = coords.longitude

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          { user_id: user.id, ...sanitizedData, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
      if (profileError) throw profileError

      const riskResults = await calculateAllRisks({
        latitude: coords.latitude,
        longitude: coords.longitude,
        housing_type: sanitizedData.housing_type,
        has_elderly: sanitizedData.has_elderly,
        has_pwd: sanitizedData.has_pwd
      })

      await logAuditEvent('RISKS_CALCULATED', {
        city: sanitizedData.city,
        district: sanitizedData.district,
        barangay: sanitizedData.barangay,
        overall_score: riskResults.overall_score,
        high_risk_count: Object.values(riskResults).filter(r => r.risk === 'HIGH').length,
        high_risks: Object.entries(riskResults)
          .filter(([, val]) => val.risk === 'HIGH')
          .map(([key]) => key)
          .join(', ')
      })

      const { error: riskError } = await supabase
        .from('risk_scores')
        .upsert({
          user_id: user.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          flood_risk: riskResults.flood.risk,
          earthquake_risk: riskResults.earthquake.risk,
          typhoon_risk: riskResults.typhoon.risk,
          landslide_risk: riskResults.landslide.risk,
          heat_risk: riskResults.heat.risk,
          overall_score: riskResults.overall_score,
          calculated_at: riskResults.calculated_at
        }, { onConflict: 'user_id' })
      if (riskError) throw riskError

      await logAuditEvent('PROFILE_UPDATED', { city: sanitizedData.city, risks_calculated: true })

      alert('Profile saved and risks calculated successfully!')
      setProfileExists(true)
      setIsEditing(false)
      onSuccess?.()

    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Error saving profile: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // View mode — shown when a profile already exists and the user is not editing
  if (profileExists && !isEditing) {
    const housingLabel = {
      'Apartment': 'Apartment',
      'House': 'House',
      'Coastal': 'Coastal (near water)',
      'Hillside': 'Hillside (elevated)',
      'High-rise': 'High-rise (condo/building)'
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 py-8 px-4 hero-background">
        <div className="max-w-3xl mx-auto">
          {/* Greeting */}
          <div className="text-center mb-8">
            <img src="/favicon.svg" alt="Handa Ka Ba Logo" className="h-20 w-auto rounded-2xl mx-auto mb-4" />
            {firstName && (
              <p className="text-lg text-gray-500 mb-1">Hello, <span className="font-semibold text-gray-700">{firstName}</span>!</p>
            )}
            <h1 className="text-5xl font-black text-blue-700 mb-2 tracking-tight">HANDAKABA</h1>
            <p className="text-gray-500">Here's your current disaster preparedness profile.</p>
          </div>

          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-5 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Your Profile</h2>
                <p className="text-blue-200 text-sm">View your saved information</p>
              </div>
              <button
                onClick={() => { setIsEditing(true); setCurrentStep(1) }}
                className="bg-white text-blue-600 px-5 py-2 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Location */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[{ label: 'City', val: formData.city }, { label: 'District', val: formData.district }, { label: 'Barangay', val: formData.barangay }].map(f => (
                    <div key={f.label} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-400 font-medium mb-1">{f.label}</p>
                      <p className="font-semibold text-gray-900">{f.val || '—'}</p>
                    </div>
                  ))}
                  <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                    {housingIcons[formData.housing_type] && (
                      <img src={housingIcons[formData.housing_type]} alt="" className="w-8 h-8" />
                    )}
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-1">Housing Type</p>
                      <p className="font-semibold text-gray-900">{housingLabel[formData.housing_type] || formData.housing_type || '—'}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-400 font-medium mb-1">Floor Level</p>
                    <p className="font-semibold text-gray-900">Floor {formData.floor_level}</p>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Household */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Household</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-400 font-medium mb-1">Household Size</p>
                    <p className="font-semibold text-gray-900">{formData.household_size} {formData.household_size === 1 ? 'person' : 'people'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-400 font-medium mb-2">Members</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.has_children && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">Children</span>}
                      {formData.has_elderly && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">Elderly</span>}
                      {formData.has_pwd && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">PWD</span>}
                      {formData.has_pets && <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">Pets</span>}
                      {!formData.has_children && !formData.has_elderly && !formData.has_pwd && !formData.has_pets && (
                        <span className="text-gray-400 text-xs">None specified</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Resources */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Resources & Needs</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.has_vehicle && <span className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full font-medium">Vehicle Available</span>}
                  {formData.medical_dependencies && <span className="bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full font-medium">Medical Dependencies</span>}
                  {!formData.has_vehicle && !formData.medical_dependencies && (
                    <span className="text-gray-400 text-sm">No special resources noted</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Edit / new-user form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 py-8 px-4 hero-background">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/favicon.svg" alt="Handa Ka Ba Logo" className="h-20 w-auto rounded-2xl" />
          </div>
          {firstName ? (
            <>
              <p className="text-lg text-gray-500 mb-1">Hello, <span className="font-semibold text-gray-700">{firstName}</span>!</p>
              <h1 className="text-5xl font-black text-blue-700 mb-3 tracking-tight">HANDAKABA</h1>
            </>
          ) : (
            <h1 className="text-5xl font-black text-blue-700 mb-3 tracking-tight">HANDAKABA</h1>
          )}
          <p className="text-lg text-gray-600">
            {profileExists ? 'Update your preparedness profile' : 'Disaster Preparedness System'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 bg-white rounded-2xl shadow-md p-6">
          <div className="flex items-center justify-center mb-4 gap-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm
                  transition-all duration-300
                  ${currentStep >= step
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg scale-110'
                    : 'bg-gray-200 text-gray-500'}
                `}>
                  {currentStep > step ? '✓' : step}
                </div>
                {step < 3 && (
                  <div className={`
                    w-24 h-1 rounded-full transition-all duration-300
                    ${currentStep > step ? 'bg-blue-600' : 'bg-gray-200'}
                  `} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">
              Step {currentStep} of 3: {
                currentStep === 1 ? 'Location' :
                  currentStep === 2 ? 'Household Information' :
                    'Resources & Needs'
              }
            </p>
          </div>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* STEP 1: LOCATION */}
          {currentStep === 1 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Location Information
                </h2>
                <p className="text-gray-600">
                  We need your address to assess disaster risks in your area
                </p>
              </div>

              <div className="space-y-5">
                {/* City */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    City *
                  </label>
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleCityChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 appearance-none"
                  >
                    <option value="">Select city...</option>
                    {getCities().map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                {/* District */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    District *
                  </label>
                  <select
                    name="district"
                    value={formData.district}
                    onChange={handleDistrictChange}
                    required
                    disabled={!formData.city}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none"
                  >
                    <option value="">
                      {formData.city ? 'Select district...' : 'Select a city first'}
                    </option>
                    {availableDistricts.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>

                {/* Barangay */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Barangay *
                  </label>
                  <select
                    name="barangay"
                    value={formData.barangay}
                    onChange={handleChange}
                    required
                    disabled={!formData.district}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none"
                  >
                    <option value="">
                      {formData.district ? 'Select barangay...' : 'Select a district first'}
                    </option>
                    {availableBarangays.map(barangay => (
                      <option key={barangay} value={barangay}>{barangay}</option>
                    ))}
                  </select>
                </div>

                {/* Housing Type */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Housing Type *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(housingIcons).map(([type, iconPath]) => (
                      <label
                        key={type}
                        className={`
                          border-2 rounded-xl p-3 cursor-pointer transition-all duration-200
                          flex flex-col items-center gap-2
                          ${formData.housing_type === type
                            ? 'border-blue-600 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          name="housing_type"
                          value={type}
                          checked={formData.housing_type === type}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <img
                          src={iconPath}
                          alt={type}
                          className="w-12 h-12"
                        />
                        <span className={`text-xs font-semibold text-center leading-tight ${formData.housing_type === type ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                          {type === 'Coastal' ? 'Coastal (near water)' :
                            type === 'Hillside' ? 'Hillside (elevated)' :
                              type === 'High-rise' ? 'High-rise (condo)' :
                                type}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Floor Level */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Floor Level (optional)
                  </label>
                  <input
                    type="number"
                    name="floor_level"
                    value={formData.floor_level}
                    onChange={handleChange}
                    min="1"
                    max="100"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 appearance-none"
                  />
                  <p className="text-sm text-gray-500 mt-1">Ground floor = 1</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="w-full mt-8 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Next: Household Information
              </button>
            </div>
          )}

          {/* STEP 2: HOUSEHOLD */}
          {currentStep === 2 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Household Information
                </h2>
                <p className="text-gray-600">
                  Help us customize your preparedness plan based on your household composition
                </p>
              </div>

              <div className="space-y-5">
                {/* Household Size */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Number of People in Household *
                  </label>
                  <input
                    type="number"
                    name="household_size"
                    value={formData.household_size}
                    onChange={handleChange}
                    min="1"
                    max="50"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-900"
                  />
                  <p className="text-sm text-gray-500 mt-1">Total number of people living in your household</p>
                </div>

                {/* Checkboxes */}
                <div className="bg-blue-50 rounded-xl p-6 space-y-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    Does your household include any of the following? (check all that apply)
                  </p>

                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      name="has_children"
                      checked={formData.has_children}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-gray-700 group-hover:text-gray-900 transition-colors">
                      Children (ages 0-12)
                    </span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      name="has_elderly"
                      checked={formData.has_elderly}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-gray-700 group-hover:text-gray-900 transition-colors">
                      Elderly (60+ years old)
                    </span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      name="has_pwd"
                      checked={formData.has_pwd}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-gray-700 group-hover:text-gray-900 transition-colors">
                      Person with Disability (PWD)
                    </span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      name="has_pets"
                      checked={formData.has_pets}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-gray-700 group-hover:text-gray-900 transition-colors">
                      Pets
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 px-6 rounded-xl hover:bg-gray-200 transition-all duration-200"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Next: Resources & Needs
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: RESOURCES */}
          {currentStep === 3 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Resources & Special Needs
                </h2>
                <p className="text-gray-600">
                  Final step - tell us about available resources and special requirements
                </p>
              </div>

              <div className="bg-orange-50 rounded-xl p-6 space-y-4">
                <label className="flex items-start space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="has_vehicle"
                    checked={formData.has_vehicle}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-gray-700 group-hover:text-gray-900 font-medium transition-colors block">
                      Vehicle Available (car, motorcycle, etc.)
                    </span>
                    <span className="text-sm text-gray-600">
                      Important for evacuation planning
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="medical_dependencies"
                    checked={formData.medical_dependencies}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-gray-700 group-hover:text-gray-900 font-medium transition-colors block">
                      Medical Dependencies (insulin, oxygen, dialysis, etc.)
                    </span>
                    <span className="text-sm text-gray-600">
                      Will be prioritized in your emergency checklist
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 px-6 rounded-xl hover:bg-gray-200 transition-all duration-200"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold py-4 px-6 rounded-xl hover:from-green-700 hover:to-green-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Submit Profile'
                  )}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Security Notice */}
        <div className="mt-6 bg-blue-100 border-l-4 border-blue-600 rounded-r-xl p-4">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">Data Security</p>
              <p className="text-sm text-blue-800">
                All your information is encrypted and securely stored. We use industry-standard security protocols to protect your personal data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
