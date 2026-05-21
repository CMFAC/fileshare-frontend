import { useEffect, useRef, useState } from "react";

function App() {
  const [status, setStatus] = useState("");
  const [files, setFiles] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const fileInputRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL;
  const API_KEY = import.meta.env.VITE_API_KEY;

  const [transferId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    let currentTransferId = params.get("transfer");

    if (!currentTransferId) {
      currentTransferId = crypto.randomUUID();
      window.history.replaceState(null, "", `?transfer=${currentTransferId}`);
    }

    return currentTransferId;
  });

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch(`${API_URL}/files?transferId=${transferId}`, {
          headers: { "x-api-key": API_KEY },
        });
        const data = await res.json();
        setFiles(data);
      } catch (err) {
        console.error(err);
      }
    };

    if (API_URL && API_KEY && transferId) {
      fetchFiles();
    }
  }, [API_URL, API_KEY, refreshTrigger, transferId]);

  const handleClearSelection = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (files.length >= 3) {
      alert(
        "Storage full! You can only store a maximum of 3 files per transfer.",
      );
      return;
    }

    const file = fileInputRef.current?.files[0];
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    setStatus("1/3 Requesting secure link...");

    try {
      const res = await fetch(`${API_URL}/request-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({
          filename: file.name,
          fileType: file.type,
          transferId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatus("2/3 Uploading directly to S3...");

      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setStatus("3/3 Notifying backend...");

      await fetch(`${API_URL}/upload-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ filename: file.name }),
      });

      setStatus("Upload Complete!");
      fileInputRef.current.value = "";
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  const handleRename = async (fileId, currentName) => {
    const newFilename = window.prompt("Enter new file name:", currentName);
    if (!newFilename || newFilename === currentName) return;

    try {
      await fetch(`${API_URL}/files/${fileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ newFilename }),
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert("Rename failed.");
    }
  };

  const handleDelete = async (fileId, s3Key) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;

    try {
      await fetch(`${API_URL}/files/${fileId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ s3Key }),
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert("Delete failed.");
    }
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Transfer link copied! Send it to your friend.");
  };

  const isAtLimit = files.length >= 3;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
          <div>
            <p className="text-sm text-blue-800 font-semibold">
              Your Secure Transfer Link
            </p>
            <p className="text-xs text-blue-600 truncate max-w-[200px] sm:max-w-md">
              {window.location.href}
            </p>
          </div>
          <button
            onClick={handleShareLink}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
          >
            Copy Link
          </button>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Upload Files
          </h2>

          <div className="flex flex-col items-center gap-4">
            <div className="flex w-full max-w-md gap-2">
              <input
                type="file"
                ref={fileInputRef}
                disabled={isAtLimit}
                className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold transition-colors ${
                  isAtLimit
                    ? "file:bg-gray-100 file:text-gray-400 cursor-not-allowed opacity-60"
                    : "file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                }`}
              />
              <button
                onClick={handleClearSelection}
                disabled={isAtLimit}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>

            <button
              onClick={handleUpload}
              disabled={isAtLimit}
              className={`w-full max-w-md font-bold py-3 px-4 rounded-lg transition duration-200 shadow-sm ${
                isAtLimit
                  ? "bg-gray-400 cursor-not-allowed text-gray-100"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isAtLimit
                ? "Transfer Full (Max 3 Files)"
                : "Add File to Transfer"}
            </button>

            {status && (
              <p
                className={`text-sm font-medium mt-2 ${
                  status.includes("Error") ? "text-red-500" : "text-green-600"
                }`}
              >
                {status}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">
            Files in this Transfer
          </h3>

          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-gray-500">
              Transfer limit: {files.length} / 3
            </span>
          </div>

          {files.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No files in this transfer yet. Add some above!
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {files.map((file) => (
                <li
                  key={file.fileId}
                  className="py-4 flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-gray-50 px-2 rounded-lg transition-colors"
                >
                  <span className="font-medium text-gray-700 truncate w-full md:w-1/3">
                    {file.filename}
                  </span>

                  <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                    <button
                      onClick={() => handleRename(file.fileId, file.filename)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium transition duration-200 shadow-sm"
                    >
                      Rename
                    </button>

                    <a
                      href={file.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium transition duration-200 shadow-sm text-center"
                    >
                      Download
                    </a>

                    <button
                      onClick={() => handleDelete(file.fileId, file.s3Key)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition duration-200 shadow-sm"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
