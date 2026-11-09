
"use client";

import { useRef, useState } from "react";

const categories = [
  { id: "pothole", icon: "🚧", name: "Pothole / Road damage" },
  { id: "garbage", icon: "🗑️", name: "Garbage accumulation" },
  { id: "water", icon: "💧", name: "Water leakage" },
  { id: "streetlight", icon: "💡", name: "Broken streetlight" },
  { id: "drainage", icon: "🌊", name: "Drainage blockage" },
  { id: "other", icon: "📍", name: "Other issue" },
];

export default function ReportPage() {
  const fileInput = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complaintId, setComplaintId] = useState("");

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5 MB.");
      return;
    }

    setImage(URL.createObjectURL(file));
    setError("");
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setError("GPS is not supported by your browser.");
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setCoordinates(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        setLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        setLoading(false);
      },
      () => {
        setError("Unable to access location. Please allow location permission or enter it manually.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!category || !description.trim() || !location.trim() || !image) {
      setError("Please complete all fields and upload a photograph.");
      return;
    }

    const id = "FMS-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setComplaintId(id);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px",
    border: "1px solid #ded9d0",
    borderRadius: "5px",
    background: "#fffefa",
    color: "#292722",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  if (complaintId) {
    return (
      <main style={{ minHeight: "100vh", background: "#f8f6f1", display: "grid", placeItems: "center", padding: "24px" }}>
        <div style={{ maxWidth: "500px", width: "100%", textAlign: "center", background: "#fffefa", padding: "48px 28px", border: "1px solid #e6e0d6", borderRadius: "8px" }}>
          <div style={{ fontSize: "48px" }}>✓</div>
          <p style={{ color: "#b47b50", letterSpacing: "3px", fontSize: "11px" }}>REPORT CREATED</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "38px", fontWeight: 400 }}>Thank you for speaking up.</h1>
          <p style={{ color: "#77746d" }}>Your demo complaint reference is:</p>
          <h2 style={{ color: "#b47b50", letterSpacing: "2px" }}>{complaintId}</h2>
          <p style={{ fontSize: "12px", color: "#89857c" }}>This is a frontend demonstration. Your report has not yet been saved to a server or sent to an authority.</p>
          <button onClick={() => window.location.reload()} style={{ background: "#292722", color: "white", padding: "14px 25px", border: 0, cursor: "pointer", marginTop: "15px" }}>Submit another report ↗</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: "#f8f6f1", minHeight: "100vh", color: "#292722", fontFamily: "Arial, sans-serif" }}>
      <header style={{ padding: "22px 7%", borderBottom: "1px solid #e5e0d7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/" style={{ fontSize: "21px", color: "#292722", textDecoration: "none", letterSpacing: "-1px" }}>
          fixmy<span style={{ color: "#b47b50" }}>street.</span>
        </a>
        <a href="/" style={{ color: "#77746d", textDecoration: "none", fontSize: "13px" }}>← Back to home</a>
      </header>

      <section style={{ maxWidth: "760px", margin: "auto", padding: "65px 22px 90px" }}>
        <p style={{ color: "#b47b50", fontSize: "11px", letterSpacing: "3px" }}>JALANDHAR · COMMUNITY REPORTING</p>

        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(38px, 6vw, 58px)", lineHeight: 1.08, margin: "16px 0" }}>
          Make your neighbourhood <span style={{ color: "#b47b50", fontStyle: "italic" }}>better.</span>
        </h1>

        <p style={{ color: "#77746d", fontSize: "14px", lineHeight: 1.8, maxWidth: "520px" }}>
          Spotted something that needs attention? Tell us about it. Every report is a step towards a better street.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: "45px" }}>
          <div style={{ marginBottom: "34px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600 }}>01. What needs fixing?</label>
            <p style={{ fontSize: "12px", color: "#89857c", margin: "7px 0 15px" }}>Choose the category that best describes the problem.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" }}>
              {categories.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setCategory(item.id)}
                  style={{
                    padding: "16px 12px",
                    textAlign: "left",
                    background: category === item.id ? "#eee5d9" : "#fffefa",
                    border: category === item.id ? "1px solid #b47b50" : "1px solid #ded9d0",
                    borderRadius: "5px",
                    cursor: "pointer",
                    color: "#292722",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ fontSize: "20px", display: "block", marginBottom: "9px" }}>{item.icon}</span>
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "34px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600 }}>02. Show us the problem</label>
            <p style={{ fontSize: "12px", color: "#89857c", margin: "7px 0 15px" }}>Upload a clear photograph of the issue. Maximum 5 MB.</p>

            <div
              onClick={() => fileInput.current?.click()}
              style={{ border: "1px dashed #c8bfb2", borderRadius: "5px", padding: "25px", textAlign: "center", background: "#fffefa", cursor: "pointer" }}
            >
              {image ? (
                <img src={image} alt="Complaint preview" style={{ maxHeight: "240px", maxWidth: "100%", objectFit: "contain" }} />
              ) : (
                <>
                  <div style={{ fontSize: "30px" }}>＋</div>
                  <p style={{ fontSize: "13px" }}>Click to upload a photograph</p>
                  <p style={{ fontSize: "11px", color: "#89857c" }}>PNG, JPG or JPEG</p>
                </>
              )}
              <input ref={fileInput} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
            </div>
          </div>

          <div style={{ marginBottom: "34px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600 }}>03. Describe the issue</label>
            <p style={{ fontSize: "12px", color: "#89857c", margin: "7px 0 15px" }}>Tell us what happened and why it needs attention.</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the problem, its severity and any other useful details..."
              rows={5}
              maxLength={1000}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <p style={{ textAlign: "right", fontSize: "11px", color: "#89857c" }}>{description.length}/1000</p>
          </div>

          <div style={{ marginBottom: "34px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600 }}>04. Where is the issue?</label>
            <p style={{ fontSize: "12px", color: "#89857c", margin: "7px 0 15px" }}>Allow GPS access or enter the location manually.</p>

            <button type="button" onClick={getLocation} disabled={loading} style={{ width: "100%", padding: "14px", background: "#eee8de", border: "1px solid #ded9d0", cursor: "pointer", color: "#292722", borderRadius: "5px", marginBottom: "12px" }}>
              📍 {loading ? "Detecting location..." : "Use my current location"}
            </button>

            <input
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setCoordinates("");
              }}
              placeholder="Enter street, area or landmark in Jalandhar"
              style={inputStyle}
            />

            {coordinates && <p style={{ fontSize: "11px", color: "#548064", marginTop: "8px" }}>GPS coordinates: {coordinates}</p>}
          </div>

          {error && <p role="alert" style={{ color: "#b34235", background: "#f8e9e5", padding: "12px", fontSize: "13px" }}>{error}</p>}

          <button type="submit" style={{ width: "100%", background: "#292722", color: "#fffefa", border: 0, padding: "17px", fontSize: "13px", cursor: "pointer", borderRadius: "4px", letterSpacing: "1px" }}>
            Submit your report ↗
          </button>

          <p style={{ textAlign: "center", color: "#89857c", fontSize: "11px", marginTop: "16px" }}>
            Your voice matters. Let's make our streets better together.
          </p>
        </form>
      </section>
    </main>
  );
}
