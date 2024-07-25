package main

import (
    "fmt"
    "io"
    "net/http"
    "os"
    "path/filepath"
    "time"
)

const (
    staticDir     = "./static"
    uploadDir     = "./static/uploads"
    fileUploadURL = "/uploads/"
)

func main() {
    // Create upload directory if it doesn't exist
    if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
        fmt.Println("Failed to create upload directory:", err)
        return
    }

    // Serve HTML files for specific routes
    http.HandleFunc("/", serveFile("index.html"))
    http.HandleFunc("/about", serveFile("about.html"))
    http.HandleFunc("/login", serveFile("login.html"))
    http.HandleFunc("/register", serveFile("register.html"))

    // Serve static files (CSS, JS, images) from the static directory
    http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

    // Handle file upload
    http.HandleFunc("/upload", uploadHandler)

    // Handle serving uploaded files
    http.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))

    // Start server
    port := ":8080"
    fmt.Printf("Server is running at http://localhost%s\n", port)
    if err := http.ListenAndServe(port, nil); err != nil {
        fmt.Println("Server failed:", err)
    }
}

// serveFile returns an HTTP handler that serves a specific file
func serveFile(filename string) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        http.ServeFile(w, r, filepath.Join(staticDir, filename))
    }
}

// uploadHandler handles file uploads
func uploadHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
        return
    }

    // Parse the form to retrieve the file
    err := r.ParseMultipartForm(10 << 20) // Limit to 10 MB
    if err != nil {
        http.Error(w, "Unable to parse form", http.StatusBadRequest)
        return
    }

    // Retrieve the file from the form
    file, fileHeader, err := r.FormFile("file")
    if err != nil {
        http.Error(w, "Unable to retrieve file", http.StatusBadRequest)
        return
    }
    defer file.Close()

    // Create a new file in the uploads directory
    fileName := fmt.Sprintf("%d-%s", time.Now().Unix(), filepath.Base(fileHeader.Filename))
    filePath := filepath.Join(uploadDir, fileName)
    outFile, err := os.Create(filePath)
    if err != nil {
        http.Error(w, "Unable to save file", http.StatusInternalServerError)
        return
    }
    defer outFile.Close()

    // Copy file content
    _, err = io.Copy(outFile, file)
    if err != nil {
        http.Error(w, "Unable to save file", http.StatusInternalServerError)
        return
    }

    // Generate file URL
    fileURL := fmt.Sprintf("%s%s", fileUploadURL, fileName)

    // Respond with the file URL
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(fmt.Sprintf(`{"fileUrl": "%s"}`, fileURL)))
}
