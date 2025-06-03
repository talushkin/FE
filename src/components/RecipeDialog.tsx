import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  IconButton,
  CircularProgress,
  Box,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { translateDirectly } from "./translateAI";
import {TRecipe, TRecipes} from "../types/recipe"; // Adjust the import path as needed

const BASE_URL = "https://be-tan-theta.vercel.app";

type Tprops = {
  open?: boolean;
  onClose: () => void;
  onSave: (recipe: any) => void;
  onDelete?: (recipe: any) => void;
  recipe?: TRecipe | null;
  targetLang?: string;
  type?: "edit" | "new";
  categoryName?: string;
  autoFill?: boolean;
}

const RecipeDialog = ({
  open = false,
  onClose,
  onSave,
  onDelete,
  recipe,
  targetLang = "en",
  type,
  categoryName,
  autoFill = false,
}: Tprops) => {
  const { i18n, t } = useTranslation();
  const isRTL = i18n.language === "he" || i18n.language === "ar";

  const [editableRecipe , setEditableRecipe] = useState<null|TRecipe>(null);

  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isFillingAI, setIsFillingAI] = useState(false);

  useEffect(() => {
    if (recipe) {
      setEditableRecipe({
        category: recipe.category,
        title: recipe.title || "",
        ingredients: recipe.ingredients || [""],
        preparation: recipe.preparation || "",
        imageUrl: recipe.imageUrl || ""
      });
    }
  }, [recipe]);

  useEffect(() => {
    if (editableRecipe && autoFill) {
      handleFillAI();
    }
  }, [autoFill]);

  useEffect(() => {
    if (!recipe || !targetLang || !open || targetLang === "en") return;
    const doTranslate = async () => {
      try {
        const [title, ingredients, preparation] = await Promise.all([
          translateDirectly(recipe.title, targetLang),
          translateDirectly(recipe.ingredients, targetLang),
          translateDirectly(recipe.preparation, targetLang),
        ]);
        setEditableRecipe((prev) => ({
          ...prev,
          title,
          ingredients,
          preparation,
          category: recipe.category, // Keep the original category
          imageUrl: recipe.imageUrl, // Keep the original image URL
        }));
      } catch (error) {
        console.error("Error during translation:", error);
      }
    };
    doTranslate();
  }, [recipe, targetLang, open]);

  const handleChange = (field:keyof TRecipe) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> ) => {
    // if(field==="")
    if(field === "ingredients" ){
      const value = event.target.value;
      const ingredientsArray = value.split("\n").map((item) => item.trim()).filter((item) => item);
      setEditableRecipe((prev) => (prev === null ? null : {
        ...prev,
        [field]: ingredientsArray,
      }));
      return;
    } {
   setEditableRecipe((prev)=>{
    if(!prev) return null;
    return {
      ...prev,
   
      [field]: event.target.value,
    }
   })
  };
}


  const handleSave = () => {
    onSave(editableRecipe);
    onClose();
  };

  const handleFillAI = async () => {
    setIsFillingAI(true);
    try {
      const authToken = localStorage.getItem("authToken") || "1234";
      const response = await fetch(`${BASE_URL}/api/ai/fill-recipe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          categoryName: categoryName,
          title: editableRecipe?.title,
          recipeId: recipe?._id,
        }),
      });
      if (!response.ok) throw new Error("Failed to fill recipe via AI");

      const data = await response.json();
      setEditableRecipe((prev) => (!prev ? null : {
        ...prev,
        ingredients: data?.ingredients,
        title: data?.title || prev.title,
        preparation: data?.preparation,
      }));
      await handleRecreateImage(data.title || editableRecipe?.title);
    } catch (error) {
      console.error("Error while filling recipe via AI:", error);
    } finally {
      setIsFillingAI(false);
    }
  };

  const handleRecreateImage = async (text = editableRecipe?.title) => {
    setIsLoadingImage(true);
    try {
      const authToken = localStorage.getItem("authToken") || "1234";
      const response = await fetch(`${BASE_URL}/api/ai/image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          text: text,
          recipeId: recipe?._id,
        }),
      });
      if (!response.ok) throw new Error("Failed to recreate image via AI");

      const data = await response.json();
      setEditableRecipe((prev) => (!prev ? null : {  
        ...prev,
        imageUrl: data.imageUrl,
      }));
    } catch (error) {
      console.error("Error while recreating image via AI:", error);
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete({...editableRecipe, _id:recipe?._id});
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dir={isRTL ? "rtl" : "ltr"}
      PaperProps={{
        style: { maxWidth: "95%", width: "95%" },
      }}
    >
      <DialogTitle
        style={{
          backgroundColor: "#f7f1e3",
          textAlign: "center",
          padding: "10px 0 0 0",
          fontSize: "20px",
        }}
      >
        {editableRecipe?.title}
        <IconButton
          onClick={onClose}
          style={{ position: "absolute", right: 8, top: 8 }}
        >
          <span style={{ fontSize: "24px", fontWeight: "bold" }}>×</span>
        </IconButton>
      </DialogTitle>

      <Box position="relative">
        {isFillingAI && (
          <Box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            bgcolor="rgba(255,255,255,0.6)"
            zIndex={10}
          >
            <CircularProgress />
          </Box>
        )}

        <DialogContent
          style={{
            backgroundColor: "#f7f1e3",
          }}
        >
          <Box
            position="relative"
            display="flex"
            justifyContent="center"
            alignItems="center"
            marginBottom={2}
          >
            <img
              src={
                editableRecipe?.imageUrl ||
                "https://placehold.co/100x100?text=No+Image"
              }
              alt={editableRecipe?.title}
              style={{ maxHeight: "300px", borderRadius: "28px" }}
            />
            {isLoadingImage && (
              <CircularProgress
                size={48}
                style={{
                  position: "absolute",
                }}
              />
            )}
            <IconButton
              onClick={() => handleRecreateImage(editableRecipe?.title)}
              title={t("recreate image")}
              style={{ position: "absolute", right: 10, top: 10 }}
            >
              <span style={{ fontSize: "24px" }}>✏️</span>
            </IconButton>
          </Box>

          <TextField
            label={t("recipeName")}
            value={editableRecipe?.title}
            onChange={handleChange("title")}
          
            fullWidth
            margin="normal"
          />
          <TextField
            label={t("ingredients")}
            value={editableRecipe?.ingredients}
            onChange={handleChange("ingredients")}
            fullWidth
            multiline
            rows={4}
            margin="normal"
          />
          <TextField
            label={t("preparation")}
            value={editableRecipe?.preparation}
            onChange={handleChange("preparation")}
            fullWidth
            multiline
            rows={4}
            margin="normal"
          />
        </DialogContent>
      </Box>

      <DialogActions>
        <Button onClick={handleFillAI} variant="contained" color="secondary">
          {t("fill AI")}
        </Button>
        <Button onClick={handleDelete} variant="contained" color="error">
          {t("delete")}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t("save")}
        </Button>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecipeDialog;
