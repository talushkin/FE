import React, { useState, useEffect } from "react";
import CaseCard from "./CaseCard";
import Pagination from "@mui/material/Pagination";
import Button from "@mui/material/Button";
import RecipeDialog from "./RecipeDialog";
import { useTranslation } from "react-i18next";
import { translateDirectly } from "./translateAI";
import { generateImage } from "./imageAI";
import { useDispatch } from "react-redux";
import { addRecipeThunk, delRecipeThunk, updateRecipeThunk } from "../store/dataSlice";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import SmartToyIcon from "@mui/icons-material/SmartToy";



function SortableRecipe({ recipe, index, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: recipe._id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: "10px",
    cursor: "grab",
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "1rem",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(recipe)}
    >
      <CaseCard item={recipe} category={recipe.category} index={index + 1} />
    </div>
  );
}

export default function MainContent({ data, selectedCategory, selectedRecipe, addRecipe, desktop, isDarkMode }) {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const [page, setPage] = useState(1);
  const [translatedCategory, setTranslatedCategory] = useState(selectedCategory?.category);
  const itemsPerPage = 8;
  const [openView, setOpenView] = useState(selectedRecipe || false);
  const [openAdd, setOpenAdd] = useState(addRecipe || false);
  const [openFill, setOpenFill] = useState(false);
  const [viewedItem, setViewedItem] = useState(selectedRecipe || null);
  const [newRecipe, setNewRecipe] = useState({
    title: "",
    ingredients: "",
    preparation: "",
  });
  const [editOrder, setEditOrder] = useState(false);
  const [rowJustify, setRowJustify] = useState(
    window.innerWidth <= 770
      ? "center"
      : (i18n.dir && i18n.dir() === "rtl")
      ? "flex-end"
      : "flex-start"
  );

  // Assume recipes are stored in selectedCategory.itemPage
  const [recipes, setRecipes] = useState(selectedCategory?.itemPage || []);
  const navigate = useNavigate();

  useEffect(() => {
    setOpenView(selectedRecipe)
  }, [selectedRecipe]);


  useEffect(() => {
    console.log("Selected category changed:", selectedCategory);
    setRecipes(selectedCategory?.itemPage || []);
  }, [selectedCategory]);

  // Translate category name
  useEffect(() => {
    const translateCategory = async () => {
      const lang = i18n.language;
      if (selectedCategory?.category && lang !== "en") {
        // Check if translation already exists in translatedCategory array
        if (
          Array.isArray(selectedCategory.translatedCategory)
        ) {
          const found = selectedCategory.translatedCategory.find(
            (t) => t.lang === lang && t.value
          );
          if (found) {
            setTranslatedCategory(found.value);
            return;
          }
        }
        // Fallback: check object format (for backward compatibility)
        if (
          selectedCategory.translatedCategory &&
          selectedCategory.translatedCategory[lang]
        ) {
          setTranslatedCategory(selectedCategory.translatedCategory[lang]);
          return;
        }
        // If not, translate and show
        const translated = await translateDirectly(selectedCategory.category, lang);
        setTranslatedCategory(translated);
      } else {
        setTranslatedCategory(selectedCategory?.category);
      }
    };
    translateCategory();
  }, [selectedCategory?.category, selectedCategory?.translatedCategory, i18n.language]);

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleRecipeDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = recipes.findIndex((r) => r._id === active.id);
      const newIndex = recipes.findIndex((r) => r._id === over.id);
      const newRecipes = arrayMove(recipes, oldIndex, newIndex);
      setRecipes(newRecipes);
      // Optionally: dispatch a thunk to persist this new order
      // dispatch(reorderRecipesThunk(newRecipes));
    }
  };

  const handleAddRecipe = async (recipe) => {
    console.log("Adding recipe:", recipe);
    let newRecipeData = {
      title: recipe?.title,
      ingredients: recipe?.ingredients,
      preparation: recipe?.preparation,
      categoryId: selectedCategory?._id,
      imageUrl: recipe?.imageUrl || "",
      category: selectedCategory?.category,
    };

    // Translate fields to English if current language is not English
    if (i18n.language !== "en") {
      try {
        const [titleEn, ingredientsEn, preparationEn] = await Promise.all([
          translateDirectly(newRecipeData.title, "en"),
          translateDirectly(newRecipeData.ingredients, "en"),
          translateDirectly(newRecipeData.preparation, "en"),
        ]);
        newRecipeData = {
          ...newRecipeData,
          title: titleEn,
          ingredients: ingredientsEn,
          preparation: preparationEn,
        };
      } catch (e) {
        // fallback to original if translation fails
      }
    }

    console.log("Adding recipe:", newRecipeData);
    try {
      const response = await dispatch(
        addRecipeThunk({ recipe: newRecipeData, category: selectedCategory })
      ).unwrap();
      console.log("Recipe added:", response);
      setRecipes([...recipes, newRecipeData]);
    } catch (error) {
      console.error("Error adding recipe:", error.response?.data || error.message);
    }

    setNewRecipe({ title: "", ingredients: "", preparation: "" });
    setOpenAdd(false);
    setOpenView(false);
  };

  // New function: Update existing recipe
  const handleUpdateRecipe = async (updatedRecipe) => {
    updatedRecipe._id = viewedItem._id; // Ensure we have the correct ID
    updatedRecipe.categoryId = selectedCategory?._id; // Ensure we have the correct category ID
    updatedRecipe.category = selectedCategory?.category; // Ensure we have the correct category name
    console.log("Updating recipe:", updatedRecipe);
    try {
      const response = await dispatch(updateRecipeThunk(updatedRecipe)).unwrap();
      console.log("Recipe updated:", response);
      setRecipes((prevRecipes) =>
        prevRecipes.map((r) => (r._id === updatedRecipe._id ? updatedRecipe : r))
      );
      setOpenView(false);
    } catch (error) {
      console.error("Error updating recipe:", error.response?.data || error.message);
    }
  };

  // Function to delete a recipe using Redux and update local state
  const handleDeleteRecipe = (recipe) => {
    if (window.confirm(t("Are you sure you want to delete this recipe? ID:" + recipe._id + " " + recipe.title))) {
      dispatch(delRecipeThunk(recipe._id))
        .unwrap()
        .then(() => {
          setRecipes((prevRecipes) =>
            prevRecipes.filter((r) => r._id !== recipe._id)
          );
        })
        .catch((err) => {
          console.error("Error deleting recipe:", err);
        });
    }
  };

  const totalItems = recipes.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = recipes.slice(startIndex, endIndex);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

const handleSelectRecipe = (recipe) => {
  console.log("Selected recipe:", recipe);
  setViewedItem(recipe);
  setOpenView(true);
  if (recipe && selectedCategory?.category && recipe?.title) {
    const categoryEncoded = encodeURIComponent(selectedCategory?.category);
    const titleEncoded = encodeURIComponent(recipe?.title);
    navigate(`/recipes/${categoryEncoded}/${titleEncoded}`);
    console.log("Navigating to:", `/recipes/${categoryEncoded}/${titleEncoded}`);
  }
};

  useEffect(() => {
    const handleResize = () => {
      setRowJustify(
        window.innerWidth <= 770
          ? "center"
          : (i18n.dir && i18n.dir() === "rtl")
          ? "flex-end"
          : "flex-start"
      );
    };
    window.addEventListener("resize", handleResize);
    // Also update on language direction change
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [i18n.language]);

  // Add this function inside MainContent, above the return:
  const handleCloseDialog = () => {
    setOpenView(false);
    setOpenAdd(false);
    if (selectedCategory?.category) {
      const categoryEncoded = encodeURIComponent(selectedCategory.category);
      navigate(`/recipes/${categoryEncoded}`);
    }
  };

  return (
    <div className="main">
      <div
        className="main-title"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "1rem",
          textAlign: "center", // <-- Add this line to center content horizontally
        }}
      >
        <div
          style={{
            flexBasis: "100%",
            textAlign: "center",
            color: isDarkMode ? "white" : "inherit",
            fontSize:
              translatedCategory && translatedCategory.length > 24
                ? "1.2rem"
                : "2rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100vw",
            lineHeight: translatedCategory && translatedCategory.length > 24
                ? "1.2rem"
                : "2rem",
                marginTop: "1rem",
          }}
          title={translatedCategory}
        >
          {translatedCategory}
        </div>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            width: "100%",
            maxWidth: "800px",
            margin: "0 auto"
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={() => setOpenAdd(true)}
            sx={{
              minWidth: "56px",
              minHeight: "56px",
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 0,
              fontWeight: "bold",
              fontSize: "0.85rem",
              gap: "0.25rem",
              backgroundColor: "darkgreen", // <-- dark green background
              "&:hover": {
                backgroundColor: "#145214",
              },
            }}
            title={t("addRecipe")}
          >
            <AddIcon sx={{ fontSize: 28 }} />
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              setOpenFill(true);
              setOpenAdd(true);
            }}
            sx={{
              minWidth: "56px",
              minHeight: "56px",
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 0,
              fontWeight: "bold",
              fontSize: "0.85rem",
              gap: "0.25rem",
              backgroundColor: "darkgreen",
              "&:hover": {
                backgroundColor: "#145214",
              },
            }}
            title={`AI ${t("addRecipe")}`}
          >
            <AddIcon sx={{ fontSize: 20, mr: 0.5 }} />
            <SmartToyIcon sx={{ fontSize: 24 }} />
          </Button>
        </div>
      </div>
      <p style={{ flexBasis: "100%", textAlign: "center" }}>
        {t("page")} {page}, {t("recipes")} {startIndex + 1}–{endIndex} {t("of")} {totalItems}
      </p>
      {totalPages > 1 && (
        <div className="pagination-container" style={{ direction: i18n.dir && i18n.dir() === "rtl" ? "rtl" : "ltr" }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            sx={{
              "& .MuiPaginationItem-root": {
                color: (theme) => theme.mode === "dark" ? "white" : "inherit",
                direction: i18n.dir && i18n.dir() === "rtl" ? "ltr" : "ltr",
              },
              "& .Mui-selected": {
                backgroundColor: isDarkMode ? "#fff" : "", // White background for selected page on dark mode
                color: isDarkMode ? "#222" : "",           // Dark text for contrast
              },
            }}
            dir={i18n.dir && i18n.dir() === "rtl" ? "ltr" : "ltr"} // For MUI v5+
          />
        </div>
      )}
      {editOrder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRecipeDragEnd}>
          <SortableContext items={recipes.map((r) => r._id)} strategy={verticalListSortingStrategy}>
            {recipes.map((recipe, index) => (
              <SortableRecipe key={recipe._id} recipe={recipe} index={index} onSelect={handleSelectRecipe} />
            ))}
          </SortableContext>
        </DndContext>
      ) : ( window.innerWidth && (
                <div
          className="row d-flex"
          style={{
            justifyContent: rowJustify,
          }}
        >
          {currentItems.map((item, index) => {
            let colClass = "col-12 col-sm-8 col-md-6 col-lg-3";
            const isRTL = i18n.dir && i18n.dir() === "rtl";
            return (
              <div
                key={index}
                className={`${colClass} mb-4 d-flex`}
                style={{
                  justifyContent: rowJustify,
                }}
                onClick={() => handleSelectRecipe(item)}
              >
                <CaseCard
                  index={startIndex + index + 1}
                  item={item}
                  category={selectedCategory?.category}
                  isDarkMode={isDarkMode}
                />
              </div>
            );
          })}
        </div>
      )

      )}
      <RecipeDialog
        open={openView}
        onClose={handleCloseDialog}
        type="view"
        recipe={viewedItem}
        onSave={(recipe) => {
          // If editing an existing recipe, call update; otherwise, add new.
          console.log("Saving recipe:", recipe, viewedItem?._id);
          viewedItem?._id ? handleUpdateRecipe(recipe) : handleAddRecipe(recipe);
        }}
        onDelete={(recipe) => {
          handleDeleteRecipe(recipe);
        }}
        targetLang={i18n.language}
      />
      <RecipeDialog
        open={openAdd}
        autoFill={openFill}
        onClose={handleCloseDialog}
        type="add"
        recipe={newRecipe}
        categoryName={selectedCategory?.category}
        onSave={(recipe) => {
          console.log("Saving recipe:", recipe, viewedItem?._id);
          handleAddRecipe(recipe);
        }}
        targetLang={i18n.language}
      />
    </div>
  );
}
