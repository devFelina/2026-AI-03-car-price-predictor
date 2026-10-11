import { useMemo, useState } from 'react'
import supportedVehicleData from './data/supported_vehicles.json'
import { apiErrorMessage } from './apiErrors.js'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000'
const PREDICTION_URL = `${API_BASE_URL.replace(/\/$/, '')}/api/predict`
const GEAR_OPTIONS = ['Automatic', 'Manual']
const FUEL_OPTIONS = ['Diesel', 'Electric', 'Hybrid', 'Petrol']
const LEASING_OPTIONS = ['No Leasing', 'Ongoing Lease']
const CONDITION_OPTIONS = ['NEW', 'USED']
const FEATURE_OPTIONS = ['Available', 'Not_Available']
const TOWN_OPTIONS = ['Ambalangoda', 'Ampara', 'Anuradapura', 'Avissawella', 'Badulla', 'Balangoda', 'Bandaragama', 'Bandarawela', 'Battaramulla', 'Batticaloa', 'Bentota', 'Beruwala', 'Boralesgamuwa', 'Chavakacheri', 'Chilaw', 'Colombo', 'Dambulla', 'Dankotuwa', 'Dehiwala-Mount-Lavinia', 'Divulapitiya', 'Dompe', 'Eheliyagoda', 'Elpitiya', 'Embilipitiya', 'Galle', 'Gampaha', 'Gampola', 'Ganemulla', 'Hambantota', 'Hanwella', 'Haputale', 'Harispattuwa', 'Hatton', 'Hendala', 'Hikkaduwa', 'Homagama', 'Horana', 'Ja-Ela', 'Jaffna', 'Kadawatha', 'Kadugannawa', 'Kaduwela', 'Kalawana', 'Kalmunai', 'Kalutara', 'Kandana', 'Kandy', 'Katunayake', 'Kegalle', 'Kelaniya', 'Kesbewa', 'Kilinochchi', 'Kiribathgoda', 'Koggala', 'Kolonnawa', 'Kotikawatta', 'Kottawa', 'Kotte', 'Kuliyapitiya', 'Kurunegala', 'Maharagama', 'Mahiyanganaya', 'Malabe', 'Mannar', 'Marawila', 'Matale', 'Matara', 'Matugama', 'Mawanella', 'Middeniya', 'Minuwangoda', 'Mirigama', 'Moneragala', 'Moratuwa', 'Mullaitivu', 'Mulleriyawa', 'Nattandiya', 'Nawala', 'Nawalapitiya', 'Negombo', 'Nittambuwa', 'Nugegoda', 'Nuwara-Eliya', 'Padukka', 'Panadura', 'Pannala', 'Pannipitiya', 'Peliyagoda', 'Piliyandala', 'Polgahawela', 'Polonnaruwa', 'Puttalam', 'Ragama', 'Rajagiriya', 'Ratnapura', 'Tangalle', 'Trincomalee', 'Vavuniya', 'Veyangoda', 'Warakapola', 'Wattala', 'Wattegama', 'Weligama', 'Welimada', 'Welisara', 'Wennappuwa']

const INITIAL_FORM = {
  brand: '', model: '', yom: '', engineCc: '', gear: '', fuelType: '',
  town: '', leasing: '', condition: '', airCondition: '',
  powerSteering: '', powerMirrors: '', powerWindows: '',
}

function localDateForApi(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}/${date.getFullYear()}`
}

function predictionWarnings(prediction) {
  if (Array.isArray(prediction?.warnings)) return prediction.warnings
  return prediction?.warning ? [prediction.warning] : []
}

const VehicleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 11.2 6.7 7a2 2 0 0 1 1.9-1.3h6.8A2 2 0 0 1 17.3 7l1.5 4.2m-13.6 0h13.6m-13.6 0A2.2 2.2 0 0 0 3 13.4v3.3c0 .6.5 1.1 1.1 1.1h1.1m13.6-6.6a2.2 2.2 0 0 1 2.2 2.2v3.3c0 .6-.5 1.1-1.1 1.1h-1.1m-13.6 0v1.1c0 .6.5 1.1 1.1 1.1h.9c.6 0 1.1-.5 1.1-1.1v-1.1m-3.1 0h13.6m0 0v1.1c0 .6-.5 1.1-1.1 1.1h-.9c-.6 0-1.1-.5-1.1-1.1v-1.1M7.2 14.4h.1m9.4 0h.1" /></svg>
)

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5V5m0 14.5h16M7.5 16l3.2-3.3 2.7 1.9 5-6.1m0 0H15m3.4 0v3.3" /></svg>
)

function SelectField({ label, name, value, options, onChange, disabled = false }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange} disabled={disabled} required>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option} value={option}>{String(option).replaceAll('_', ' ')}</option>)}
      </select>
    </label>
  )
}

function App() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [isLoading, setIsLoading] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const vehicles = supportedVehicleData.vehicles
  const brands = useMemo(
    () => [...new Set(vehicles.map(({ brand }) => brand))].sort(),
    [vehicles],
  )
  const models = useMemo(
    () => vehicles.filter(({ brand }) => brand === form.brand).map(({ model }) => model).sort(),
    [form.brand, vehicles],
  )
  const selectedSupport = useMemo(
    () => vehicles.find(({ brand, model }) => brand === form.brand && model === form.model),
    [form.brand, form.model, vehicles],
  )
  const manufacturingYears = selectedSupport?.manufacturing_years ?? []
  const engineCcOptions = selectedSupport?.engine_cc_options ?? []
  const hasValidOptions = manufacturingYears.length > 0 && engineCcOptions.length > 0

  const updateField = ({ target: { name, value } }) => {
    const dependentResets = name === 'brand'
      ? { model: '', yom: '', engineCc: '' }
      : name === 'model'
        ? { yom: '', engineCc: '' }
        : {}
    setForm((current) => ({ ...current, [name]: value, ...dependentResets }))
    setPrediction(null)
    setSubmitError('')
  }

  const submitPrediction = async (event) => {
    event.preventDefault()
    if (isLoading || !hasValidOptions) return

    const payload = {
      Brand: form.brand,
      Model: form.model,
      YOM: Number(form.yom),
      'Engine (cc)': Number(form.engineCc),
      Gear: form.gear,
      'Fuel Type': form.fuelType,
      'Mileage(KM)': 0,
      Town: form.town,
      Date: localDateForApi(),
      Leasing: form.leasing,
      Condition: form.condition,
      'AIR CONDITION': form.airCondition,
      'POWER STEERING': form.powerSteering,
      'POWER MIRROR': form.powerMirrors,
      'POWER WINDOW': form.powerWindows,
    }

    setIsLoading(true)
    setSubmitError('')
    setPrediction(null)

    try {
      const response = await fetch(PREDICTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(apiErrorMessage(body, response.status))
      setPrediction(body)
    } catch (error) {
      setSubmitError(
        error instanceof TypeError
          ? 'Could not connect to the prediction service. Confirm that the Express backend is running on port 5000.'
          : error.message,
      )
    } finally {
      setIsLoading(false)
    }
  }

  const showCoverageWarning = selectedSupport && selectedSupport.support_category !== 'well_represented'

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">VP</div>
        <div className="brand-copy"><span className="eyebrow">Machine learning project</span><span className="brand-name">Vehicle Price Estimator</span></div>
        <span className="location-pill">Sri Lanka</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <span className="section-label">Data-informed vehicle pricing</span>
            <h1 id="page-title">A clearer starting point for vehicle values.</h1>
            <p>This system estimates prices of common Sri Lankan vehicles using machine learning and patterns learned from local vehicle listings.</p>
            <div className="status-line"><span className="status-dot" aria-hidden="true" />Interface foundation ready</div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="road-line road-line-one" /><div className="road-line road-line-two" />
            <div className="vehicle-outline"><VehicleIcon /></div>
            <div className="metric-card metric-card-top"><span>Market context</span><strong>LKR</strong></div>
            <div className="metric-card metric-card-bottom"><span>Estimate flow</span><strong>01 — 02</strong></div>
          </div>
        </section>

        <section className="workspace" aria-label="Estimation workspace">
          <div className="workspace-heading"><span className="section-label">Estimation workspace</span><h2>Designed as a simple two-step experience.</h2></div>
          <div className="estimator-layout">
            <article className="details-panel">
              <div className="panel-heading">
                <div><span className="step-number">01</span><h3>Vehicle Details</h3><p>Enter the vehicle specifications used for the estimate.</p></div>
                <span className="icon-wrap"><VehicleIcon /></span>
              </div>
              <form className="vehicle-form" onSubmit={submitPrediction}>
                <div className="form-grid">
                  <SelectField label="Brand" name="brand" value={form.brand} options={brands} onChange={updateField} />
                  <SelectField label="Model" name="model" value={form.model} options={models} onChange={updateField} disabled={!form.brand} />
                  <SelectField label="Year of Manufacture (YOM)" name="yom" value={form.yom} options={manufacturingYears} onChange={updateField} disabled={!selectedSupport || manufacturingYears.length === 0} />
                  <SelectField label="Engine CC" name="engineCc" value={form.engineCc} options={engineCcOptions} onChange={updateField} disabled={!selectedSupport || engineCcOptions.length === 0} />
                  <SelectField label="Gear" name="gear" value={form.gear} options={GEAR_OPTIONS} onChange={updateField} />
                  <SelectField label="Fuel Type" name="fuelType" value={form.fuelType} options={FUEL_OPTIONS} onChange={updateField} />
                  <SelectField label="Town" name="town" value={form.town} options={TOWN_OPTIONS} onChange={updateField} />
                  <SelectField label="Leasing" name="leasing" value={form.leasing} options={LEASING_OPTIONS} onChange={updateField} />
                  <SelectField label="Condition" name="condition" value={form.condition} options={CONDITION_OPTIONS} onChange={updateField} />
                  <SelectField label="Air Conditioning" name="airCondition" value={form.airCondition} options={FEATURE_OPTIONS} onChange={updateField} />
                  <SelectField label="Power Steering" name="powerSteering" value={form.powerSteering} options={FEATURE_OPTIONS} onChange={updateField} />
                  <SelectField label="Power Mirrors" name="powerMirrors" value={form.powerMirrors} options={FEATURE_OPTIONS} onChange={updateField} />
                  <SelectField label="Power Windows" name="powerWindows" value={form.powerWindows} options={FEATURE_OPTIONS} onChange={updateField} />
                </div>
                {showCoverageWarning && (
                  <div className={`coverage-note ${selectedSupport.support_category}`} role="status">
                    <strong>{selectedSupport.support_category === 'limited' ? 'Limited coverage' : 'Very limited coverage'}</strong>
                    <span>{selectedSupport.training_count} training records for this Brand + Model. Coverage is not an accuracy guarantee.</span>
                  </div>
                )}
                {selectedSupport && !hasValidOptions && (
                  <div className="option-error" role="alert">
                    No valid manufacturing year or engine capacity options are available for this Brand + Model.
                  </div>
                )}
                {submitError && <div className="submit-error" role="alert">{submitError}</div>}
                <button className="predict-button" type="submit" disabled={isLoading || !hasValidOptions}>
                  {isLoading ? <><span className="loading-spinner" aria-hidden="true" />Estimating…</> : 'Predict Price'}
                </button>
                <p className="required-note">All visible fields are required. Mileage is not requested because it is not used by the saved model pipeline.</p>
              </form>
            </article>

            <article className={`placeholder-card accent-card result-placeholder ${prediction ? 'has-result' : ''}`} aria-live="polite">
              <div className="card-topline"><span className="step-number">02</span><span className="icon-wrap"><ChartIcon /></span></div>
              {prediction ? (
                <div className="prediction-result">
                  <span className="result-label">Estimated Price</span>
                  <strong className="lkr-price">LKR {Number(prediction.predicted_price_lkr).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  <span className="lakhs-price">{Number(prediction.predicted_price_lakhs).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lakhs</span>
                  <dl className="result-meta">
                    <div><dt>Vehicle</dt><dd>{prediction.brand} {prediction.model}</dd></div>
                    <div><dt>Training coverage</dt><dd>{prediction.training_count} records</dd></div>
                    <div><dt>Support category</dt><dd>{prediction.support_category.replaceAll('_', ' ')}</dd></div>
                  </dl>
                  {predictionWarnings(prediction).length > 0 && (
                    <div className="result-warning" role="status">
                      <strong>Important notes</strong>
                      <ul>
                        {predictionWarnings(prediction).map((warning) => <li key={warning}>{warning}</li>)}
                      </ul>
                    </div>
                  )}
                  <p className="estimate-note">This is a machine-learning estimate, not a guaranteed market value.</p>
                </div>
              ) : (
                <>
                  <div><h3>Price Estimation</h3><p>Complete the vehicle details and select Predict Price to view an estimated value and training coverage.</p></div>
                  <span className="placeholder-tag">Awaiting vehicle details</span>
                </>
              )}
            </article>
          </div>
        </section>
      </main>
      <footer><span>Vehicle Price Prediction System</span><span>University project · Sri Lanka</span></footer>
    </div>
  )
}

export default App
