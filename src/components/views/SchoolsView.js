import React, { useState } from "react";
import { Plus, School, Edit2, Save, X } from "lucide-react";
import "../../styles/SchoolsView.css";

const SchoolsView = ({ schools, onCreateSchool, onUpdateSchool }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    organization: "",
    address: "",
    contactEmail: "",
    phone: "",
    yearbookAdvisorEmail: "",
    exportSettings: {
      csv: true,
      pspa: false,
      teacherease: false,
      skyward: false,
      fourup: false,
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSchool) {
        await onUpdateSchool(editingSchool.id, formData);
        setEditingSchool(null);
        alert("School updated successfully!");
      } else {
        await onCreateSchool(formData);
        alert("School created successfully!");
      }
      setFormData({
        name: "",
        organization: "",
        address: "",
        contactEmail: "",
        phone: "",
        yearbookAdvisorEmail: "",
        exportSettings: {
          csv: true,
          pspa: false,
          teacherease: false,
          skyward: false,
          fourup: false,
        },
      });
      setShowForm(false);
    } catch (error) {
      alert("Error saving school: " + error.message);
    }
  };

  const handleEdit = (school) => {
    setEditingSchool(school);
    setFormData({
      name: school.name || "",
      organization: school.organization || "",
      address: school.address || "",
      contactEmail: school.contactEmail || "",
      phone: school.phone || "",
      yearbookAdvisorEmail: school.yearbookAdvisorEmail || "",
      exportSettings: school.exportSettings || {
        csv: true,
        pspa: false,
        teacherease: false,
        skyward: false,
        fourup: false,
      },
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingSchool(null);
    setFormData({
      name: "",
      organization: "",
      address: "",
      contactEmail: "",
      phone: "",
      yearbookAdvisorEmail: "",
      exportSettings: {
        csv: true,
        pspa: false,
        teacherease: false,
        skyward: false,
        fourup: false,
      },
    });
  };

  const handleExportSettingChange = (exportType, checked) => {
    setFormData({
      ...formData,
      exportSettings: {
        ...formData.exportSettings,
        [exportType]: checked,
      },
    });
  };

  return (
    <div className="schools-view">
      <div className="card-header">
        <h2 className="card-title">Manage Schools</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="button button-primary"
          >
            <Plus style={{ width: "16px", height: "16px" }} />
            Add School
          </button>
        )}
      </div>

      {showForm && (
        <div className="schools-card">
          <h3 className="schools-form-title">
            {editingSchool ? "Edit School" : "Add New School"}
          </h3>
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
              <div className="input-group">
                <input
                  type="email"
                  placeholder="Yearbook Advisor Email"
                  value={formData.yearbookAdvisorEmail}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      yearbookAdvisorEmail: e.target.value,
                    })
                  }
                  className="input"
                />
              </div>
            </div>

            <div className="export-settings-section">
              <h4 className="export-settings-title">Export Settings</h4>
              <p className="export-settings-description">
                Select which export formats this school needs:
              </p>
              <div className="export-settings-grid">
                <label className="export-setting-item">
                  <input
                    type="checkbox"
                    checked={formData.exportSettings.csv}
                    onChange={(e) =>
                      handleExportSettingChange("csv", e.target.checked)
                    }
                  />
                  <span>CSV Export</span>
                </label>
                <label className="export-setting-item">
                  <input
                    type="checkbox"
                    checked={formData.exportSettings.pspa}
                    onChange={(e) =>
                      handleExportSettingChange("pspa", e.target.checked)
                    }
                  />
                  <span>PSPA Export</span>
                </label>
                <label className="export-setting-item">
                  <input
                    type="checkbox"
                    checked={formData.exportSettings.teacherease}
                    onChange={(e) =>
                      handleExportSettingChange("teacherease", e.target.checked)
                    }
                  />
                  <span>TeacherEase Export</span>
                </label>
                <label className="export-setting-item">
                  <input
                    type="checkbox"
                    checked={formData.exportSettings.skyward}
                    onChange={(e) =>
                      handleExportSettingChange("skyward", e.target.checked)
                    }
                  />
                  <span>Skyward Export</span>
                </label>
                <label className="export-setting-item">
                  <input
                    type="checkbox"
                    checked={formData.exportSettings.fourup}
                    onChange={(e) =>
                      handleExportSettingChange("fourup", e.target.checked)
                    }
                  />
                  <span>4-Up Labels Export</span>
                </label>
              </div>
            </div>

            <div className="schools-form-actions">
              <button type="submit" className="button button-primary">
                {editingSchool ? (
                  <>
                    <Save style={{ width: "16px", height: "16px" }} />
                    Update School
                  </>
                ) : (
                  "Create School"
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
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
                <div className="school-card-header">
                  <h4 className="school-name">{school.name}</h4>
                  <button
                    onClick={() => handleEdit(school)}
                    className="school-edit-button"
                    title="Edit School"
                  >
                    <Edit2 style={{ width: "16px", height: "16px" }} />
                  </button>
                </div>
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
                {school.yearbookAdvisorEmail && (
                  <p className="school-detail">
                    Yearbook: {school.yearbookAdvisorEmail}
                  </p>
                )}
                {school.exportSettings && (
                  <div className="school-exports">
                    <p className="school-exports-label">Enabled Exports:</p>
                    <div className="school-exports-list">
                      {school.exportSettings.csv && (
                        <span className="export-badge">CSV</span>
                      )}
                      {school.exportSettings.pspa && (
                        <span className="export-badge">PSPA</span>
                      )}
                      {school.exportSettings.teacherease && (
                        <span className="export-badge">TeacherEase</span>
                      )}
                      {school.exportSettings.skyward && (
                        <span className="export-badge">Skyward</span>
                      )}
                      {school.exportSettings.fourup && (
                        <span className="export-badge">4-Up</span>
                      )}
                    </div>
                  </div>
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
