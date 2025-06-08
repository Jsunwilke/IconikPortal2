import React, { useState } from "react";
import { Plus, School } from "lucide-react";
import "../../styles/SchoolsView.css";

const SchoolsView = ({ schools, onCreateSchool }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    organization: "",
    address: "",
    contactEmail: "",
    phone: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onCreateSchool(formData);
      setFormData({
        name: "",
        organization: "",
        address: "",
        contactEmail: "",
        phone: "",
      });
      setShowForm(false);
      alert("School created successfully!");
    } catch (error) {
      alert("Error creating school: " + error.message);
    }
  };

  return (
    <div className="schools-view">
      <div className="card-header">
        <h2 className="card-title">Manage Schools</h2>
        <button
          onClick={() => setShowForm(true)}
          className="button button-primary"
        >
          <Plus style={{ width: "16px", height: "16px" }} />
          Add School
        </button>
      </div>

      {showForm && (
        <div className="schools-card">
          <h3 className="schools-form-title">Add New School</h3>
          <form onSubmit={handleSubmit}>
            <div className="schools-form-grid">
              <div className="input-group">
                <input
                  type="text"
                  placeholder="School Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Organization/District"
                  value={formData.organization}
                  onChange={(e) =>
                    setFormData({ ...formData, organization: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="input-group">
                <input
                  type="email"
                  placeholder="Contact Email"
                  value={formData.contactEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, contactEmail: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="input-group">
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="input"
                />
              </div>
            </div>
            <div className="schools-form-actions">
              <button type="submit" className="button button-primary">
                Create School
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="button button-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="schools-card">
        <h3 className="schools-list-title">Schools ({schools.length})</h3>
        {schools.length === 0 ? (
          <div className="empty-state">
            <School className="empty-state-icon" />
            <h3 className="empty-state-title">No Schools Found</h3>
            <p className="empty-state-text">
              Create your first school to get started.
            </p>
          </div>
        ) : (
          <div className="schools-grid">
            {schools.map((school) => (
              <div key={school.id} className="school-card">
                <h4 className="school-name">{school.name}</h4>
                {school.organization && (
                  <p className="school-detail">{school.organization}</p>
                )}
                {school.address && (
                  <p className="school-detail">{school.address}</p>
                )}
                {school.contactEmail && (
                  <p className="school-detail">{school.contactEmail}</p>
                )}
                {school.phone && (
                  <p className="school-detail">{school.phone}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolsView;
