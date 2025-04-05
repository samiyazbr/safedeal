import React, { useState } from "react";
import axios from "axios";
import "./index.css"

const App = () => {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [remark, setRemark] = useState("");
  const [files, setFiles] = useState([]);
  const [searchResult, setSearchResult] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  
  const handleFileChange = (e) => {
    setFiles(e.target.files);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { username, password } = e.target.elements;
    try {
      const response = await axios.post("http://localhost:5001/login", {
        username: username.value,
        password: password.value,
      });
      localStorage.setItem("token", response.data.token);
      setToken(response.data.token);
    } catch (error) {
      alert("Login failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token"); // remove JWT token
    setToken("");                     // clear state
    // Optional: redirect to login or show a message
  };
  

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append("invoiceNumber", invoiceNumber);
    formData.append("remark", remark);
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    try {
      await axios.post("http://localhost:5001/upload", formData, {
        headers: {
          Authorization: token,
          "Content-Type": "multipart/form-data",
        },
      });
      alert("Upload successful");
    } catch (error) {
      alert("Upload failed");
    }
  };

  const handleSearch = async () => {
    try {
      const response = await axios.get(`http://localhost:5001/search/${invoiceNumber}`, {
        headers: { Authorization: token },
      });
      setSearchResult(response.data);
    } catch (error) {
      alert("Invoice not found");
    }
  };
  
  const deleteInvoice = async () => {
    if (!invoiceNumber) {
      alert("Please enter an invoice number to delete.");
      return;
    }
  
    try {
      const response = await axios.delete(`http://localhost:5001/delete/${invoiceNumber}`, {
        headers: {
          Authorization: token, 
        },
      });
  
      if (response.status === 200) {
        alert("Invoice deleted successfully");
        setSearchResult(null); // Clear the search result after deletion
      } else {
        alert("Failed to delete invoice");
      }
    } catch (error) {
      alert("Error deleting invoice: " + (error.response?.data || error.message));
    }
  };  

  return (
    <div className="container mx-auto p-4">
      {!token ? (
        <form onSubmit={handleLogin} className="bg-gray-200 p-4 rounded">
          <input type="text" name="username" placeholder="Username" className="p-2" />
          <input type="password" name="password" placeholder="Password" className="p-2 ml-2" />
          <button type="submit" className="bg-blue-500 text-white p-2 ml-2">Login</button>
        </form>
      ) : (
        <>
          <div className="mb-4">
            <input type="text" placeholder="Invoice Number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="border p-2" />
            <input type="text" placeholder="Remark" value={remark} onChange={(e) => setRemark(e.target.value)} className="border p-2 ml-2" />
            <input type="file" multiple onChange={handleFileChange} className="border p-2 ml-2" />
            <button onClick={handleUpload} className="bg-green-500 text-white p-2 ml-2">Upload</button>
          </div>
          {token && (
            <button
              onClick={handleLogout}
              className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow"
            >
              Logout
            </button>
          )}


          <div>
            <button onClick={handleSearch} className="bg-blue-500 text-white p-2">Search Invoice</button>
            <button onClick={deleteInvoice} className="bg-red-500 text-white p-2 ml-2">Delete Invoice</button>
            {searchResult && (
              <div className="mt-4 p-4 border">
                <h3>Invoice: {searchResult.invoiceNumber}</h3>
                <p>Remark: {searchResult.remark}</p>
                <ul>
                  {searchResult.fileLinks.map((link, index) => (
                    <li key={index}><a href={link} target="_blank" rel="noopener noreferrer">View File {index + 1}</a></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default App;