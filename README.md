# Handakaba 🚨

Handakaba is a localized Disaster Preparedness and Risk Assessment web application designed specifically for Metro Manila. It helps households understand their vulnerability to localized hazards (floods, earthquakes, typhoons, landslides) and provides them with an actionable, highly-tailored preparedness checklist based on their precise location and living situation.

## Features
- **Hyper-Localized Risk Dashboard:** Generates an algorithmic risk score based on the user's specific barangay and city within Metro Manila.
- **Dynamic Checklists:** Auto-generates preparation tasks categorized by priority (Critical, High, Medium) tailored to the household's structural integrity, proximity to water, and family demographics (infants, seniors, pets).
- **Hazard Map Integration:** Interactive Leaflet map displaying real-world hazard zones.
- **Peer Comparison:** Aggregates anonymized city-wide statistics to show users how their preparedness compares to their neighbors.
- **Printable PDF Export:** Generates clean, physical copies of the emergency checklist for offline use during power outages.

## Data Sources & Legal Attribution

### Project NOAH (Nationwide Operational Assessment of Hazards)
The hazard layers and risk profiling data used in this application are derived from the geographical data provided by **Project NOAH**.

**Attribution Notice:**
> Contains information and hazard data from [Project NOAH](https://noah.up.edu.ph/), which is made available under the [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1.0/). 

Any modifications, alterations, or geographic subsets of this data built into the Handakaba database are considered Derivative Databases and are also licensed openly under the ODbL v1.0.

### Philippine Geographic Data
Metro Manila city, municipality, and barangay boundaries are standard geographical codes (PSGC). For the purpose of speed and offline-capability, this application uses a highly-optimized, hardcoded subset of Metro Manila locations.

## Tech Stack
- **Frontend:** React (Vite)
- **Styling:** TailwindCSS / Vanilla CSS
- **Backend/Database:** Supabase (PostgreSQL)
- **Mapping:** React Leaflet / OpenStreetMap

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env.local` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## License
Application Source Code: MIT License
Underlying Hazard Database: Open Database License (ODbL) v1.0
