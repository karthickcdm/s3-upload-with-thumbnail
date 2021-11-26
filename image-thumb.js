const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const port = 3100;

const fs = require('fs');
const AWS = require('aws-sdk');
const { join } = require("path")

const { rejects } = require('assert');
const s3 = new AWS.S3({
  accessKeyId: 'AKIAR5GJGX34XOQ2I7VX',
  secretAccessKey: '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'
});

const pdf = require('pdf-thumbnail');
const pdfBuffer = require('fs').readFileSync('uploads/DraftSLA_US.pdf');

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

const url = "https://tribez-backend-app.s3.ap-south-1.amazonaws.com/";

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
    if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png' || file.mimetype == 'application/pdf') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}

const uploadPDF = (file) => {
    console.log(file);
    
}

const generateThumbnailForPDF = (file) => {

    const thumbnailName = file.originalname.split('.');
    console.log('PDF upload');
    console.log(thumbnailName[0]);
    console.log(__dirname)
    
    pdf(fs.readFileSync(join(__dirname, "uploads", file.originalname)), {
        compress: {
          type:"JPEG",
          quality: 70
        }
      })
        .then(data /*is a buffer*/ => 
            {
                const wstream = fs.createWriteStream(join(__dirname, "uploads", thumbnailName[0]+".jpg"))
                wstream.on('finish', function() {
                    console.log('.jpg');
                    console.log(thumbnailName[0]+'.jpg');
                    uploadImage({originalname: thumbnailName[0]+'.jpg'});
                })
                data.pipe(wstream);
            })
        .catch(err => console.error(err))
      

}

const uploadImage = (file) =>{
    console.log("Uploading file");
    console.log(file.originalname);
    const fileName = 'uploads/' + file.originalname;
    const readStream = fs.createReadStream(fileName);
    const params = {
        Bucket: 'tribez-backend-app',
        Key: file.originalname,
        Body: readStream,
        ACL:'public-read'
    };

    return new Promise((resolve, reject) => {
        s3.upload(params, function(err, data) {
          readStream.destroy();
          
          if (err) {
              console.log("err");
            return reject(err);
          }
          
          console.log("done");
          console.log(data);
          return resolve(data);
        });
      });
    
}

const upload = multer({ storage: storage, fileFilter: fileFilter });

//Configure sharp

//Upload route
app.post('/upload', upload.single('image'), (req, res, next) => {
    console.log(req.file);
    try {
        if(req.file && req.file.mimetype == 'application/pdf'){
            console.log('file type pdf supported');
            const pdfName = 'uploads/' + req.file.originalname;
            const thumbnailName = req.file.originalname.split('.');
            generateThumbnailForPDF(req.file);
            // uploadImage(pdfName);
            return res.status(201).json({
                message: 'File (PDF) uploded successfully',
                fileUrl: url+req.file.originalname,
                thumbnailUrl: url+'thumbnails-'+thumbnailName[0]+'.jpg'
            });
        } else if (req.file && (req.file.mimetype == 'image/jpeg' || req.file.mimetype == 'image/png') ) {
            console.log('file type supported');
            sharp(req.file.path).resize(200, 200).toFile('uploads/' + 'thumbnails-'+ req.file.originalname, (err, resizeImage) => {
                if (err) {
                    console.log('Err in generating thumbanil');
                    console.log(err);
                    return res.status(201).json({
                        message: 'Error in generating thumbnail, file uploaded'
                    });
                } else {
                    const fileName = {originalname: 'thumbnails-' + req.file.originalname};
                    uploadImage(fileName);
                    return res.status(201).json({
                        message: 'File (image) uploded successfully',
                        fileUrl: url+req.file.originalname,
                        thumbnailUrl: url+'thumbnails-'+req.file.originalname
                    });

                }
            })
            
        } else {
            console.log('file type not supported');
            return res.status(201).json({
                message: 'File type not supported'
            });
        }
        
    } catch (error) {
        console.error(error);
    }
});

app.listen(port, () => console.log(`Image Thumbnail Upload app listening at port: ${port}!`));