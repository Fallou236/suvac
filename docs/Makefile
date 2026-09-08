# Compilation du cahier des charges
# Prérequis : TeX Live avec xelatex, polyglossia, tcolorbox, pgfgantt
#             et les polices TeX Gyre Pagella / Heros.

DOC = cahier-des-charges

all: $(DOC).pdf

$(DOC).pdf: $(DOC).tex
	xelatex -interaction=nonstopmode $(DOC).tex
	xelatex -interaction=nonstopmode $(DOC).tex
	xelatex -interaction=nonstopmode $(DOC).tex

clean:
	rm -f *.aux *.log *.out *.toc

mrproper: clean
	rm -f $(DOC).pdf

.PHONY: all clean mrproper
