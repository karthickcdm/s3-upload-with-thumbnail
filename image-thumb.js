const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const pdf = require('pdf-thumbnail');

const port = 3000;

const fs = require('fs');
const AWS = require('aws-sdk');
const { rejects } = require('assert');
const s3 = new AWS.S3({
  accessKeyId: 'AKIAR5GJGX34XOQ2I7VX',
  secretAccessKey: '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'
});

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        uploadImage(file);
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
        cb(null, true);
    } else {
        uploadPDF(file);
        cb(null, false);
    }
}


const uploadPDF = (file) => {
    console.log(file);
    
}

const uploadImage = (file) =>{
    console.log("file.originalname");
    console.log(file.originalname);
    const fileName = 'uploads/' + file.originalname;
    const readStream = fs.createReadStream(fileName);
    const params = {
        Bucket: 'tribez-backend-app',
        Key: Date.now()+'-'+file.originalname,
        Body: readStream
    };

    return new Promise((resolve, reject) => {
        s3.upload(params, function(err, data) {
          readStream.destroy();
          
          if (err) {
              console.log("err");
            return reject(err);
          }
          
          console.log("done");
          return resolve(data);
        });
      });
    
}

const upload = multer({ storage: storage, fileFilter: fileFilter });

//Configure sharp

//Upload route
app.post('/upload', upload.single('image'), (req, res, next) => {
    try {
        sharp(req.file.path).resize(200, 200).toFile('uploads/' + 'thumbnails-'+ req.file.originalname, (err, resizeImage) => {
            if (err) {
                console.log(err);
            } else {
                const fileName = 'uploads/' + 'thumbnails-' + req.file.originalname;
                const readStream = fs.createReadStream(fileName);
                const params = {
                    Bucket: 'tribez-backend-app',
                    Key: fileName,
                    Body: readStream
                };

                return new Promise((resolve, reject) => {
                    s3.upload(params, function(err, data) {
                    readStream.destroy();
                    
                    if (err) {
                        console.log("err");
                        return reject(err);
                    }
                    
                    return res.status(201).json({
                        message: 'File uploded successfully'
                    });
                    return resolve(data);
                    
                    });
                });

                

            }
        })
        
    } catch (error) {
        console.error(error);
    }
});

app.listen(port, () => console.log(`Hello world app listening on port ${port}!`));